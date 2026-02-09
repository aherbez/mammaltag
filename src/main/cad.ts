import { ipcMain } from "electron";
import fs from "fs";
import path from "path";
import opentype from "opentype.js";

// OpenCascade is loaded once and cached for the lifetime of the process.
// Uses dynamic import() because the package is ESM ("type": "module").
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ocPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getOC(): Promise<any> {
  if (!ocPromise) {
    // Vite bundles the Emscripten glue code into out/main/, but the WASM file
    // stays in node_modules. Resolve the real path at runtime so the Emscripten
    // runtime can find it.
    const pkgDir = path.dirname(require.resolve("opencascade.js/package.json"));
    const wasmPath = path.join(pkgDir, "dist", "opencascade.full.wasm");
    ocPromise = import("opencascade.js/dist/node.js").then((mod) =>
      mod.default({ mainWasm: wasmPath }),
    );
  }
  return ocPromise;
}

export interface MeshData {
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeToMesh(oc: any, shape: any): MeshData {
  new oc.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.1, false);

  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  const faceExplorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );

  while (faceExplorer.More()) {
    const face = oc.TopoDS.Face_1(faceExplorer.Current());
    const location = new oc.TopLoc_Location_1();
    const handleTri = oc.BRep_Tool.Triangulation(
      face,
      location,
      0, // Poly_MeshPurpose_NONE
    );

    if (!handleTri.IsNull()) {
      const tri = handleTri.get();
      const transform = location.Transformation();
      const nbNodes = tri.NbNodes();
      const nbTriangles = tri.NbTriangles();
      const reversed =
        face.Orientation_1() === oc.TopAbs_Orientation.TopAbs_REVERSED;

      if (!tri.HasNormals()) {
        tri.ComputeNormals();
      }

      for (let i = 1; i <= nbNodes; i++) {
        const p = tri.Node(i).Transformed(transform);
        vertices.push(p.X(), p.Y(), p.Z());

        const n = tri.Normal_1(i);
        const dir = reversed ? -1 : 1;
        normals.push(n.X() * dir, n.Y() * dir, n.Z() * dir);
      }

      for (let i = 1; i <= nbTriangles; i++) {
        const t = tri.Triangle(i);
        const n1 = t.Value(1) - 1 + vertexOffset;
        const n2 = t.Value(2) - 1 + vertexOffset;
        const n3 = t.Value(3) - 1 + vertexOffset;
        if (reversed) {
          indices.push(n1, n3, n2);
        } else {
          indices.push(n1, n2, n3);
        }
      }

      vertexOffset += nbNodes;
    }

    faceExplorer.Next();
  }

  return {
    vertices: new Float32Array(vertices),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  };
}

// ---------------------------------------------------------------------------
// Text → OpenCascade shape via opentype.js
//
// OpenCascade.js's WASM build has no working FreeType file I/O, so we parse
// fonts with opentype.js (pure JS), extract glyph outlines as polylines,
// and convert them to OC wire → face → extruded solid.
// ---------------------------------------------------------------------------

interface Pt {
  x: number;
  y: number;
}

function sampleQuadBezier(p0: Pt, cp: Pt, p1: Pt, n = 8): Pt[] {
  const pts: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const s = 1 - t;
    pts.push({
      x: s * s * p0.x + 2 * s * t * cp.x + t * t * p1.x,
      y: s * s * p0.y + 2 * s * t * cp.y + t * t * p1.y,
    });
  }
  return pts;
}

function sampleCubicBezier(p0: Pt, c1: Pt, c2: Pt, p1: Pt, n = 8): Pt[] {
  const pts: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const s = 1 - t;
    pts.push({
      x:
        s * s * s * p0.x +
        3 * s * s * t * c1.x +
        3 * s * t * t * c2.x +
        t * t * t * p1.x,
      y:
        s * s * s * p0.y +
        3 * s * s * t * c1.y +
        3 * s * t * t * c2.y +
        t * t * t * p1.y,
    });
  }
  return pts;
}

function signedArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return a / 2;
}

function pointInPolygon(pt: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (
      poly[i].y > pt.y !== poly[j].y > pt.y &&
      pt.x <
        ((poly[j].x - poly[i].x) * (pt.y - poly[i].y)) /
          (poly[j].y - poly[i].y) +
          poly[i].x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

// Locate a .ttf font on the host OS.
function findSystemFont(): string {
  const candidates = [
    // Linux
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
    // macOS
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    // Windows
    "C:\\Windows\\Fonts\\arial.ttf",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    "No system font found. Install dejavu-sans or liberation-sans.",
  );
}

let cachedFont: opentype.Font | null = null;

function getFont(): opentype.Font {
  if (!cachedFont) {
    cachedFont = opentype.loadSync(findSystemFont());
  }
  return cachedFont;
}

/** Convert a text string into an array of closed polyline contours. */
function textToContours(text: string, fontSize: number): Pt[][] {
  const font = getFont();

  // Center horizontally and vertically
  const advance = font.getAdvanceWidth(text, fontSize);
  const xOff = -advance / 2;
  const scale = fontSize / font.unitsPerEm;
  const yOff = -((font.ascender + font.descender) / 2) * scale;

  const path = font.getPath(text, xOff, yOff, fontSize);

  const contours: Pt[][] = [];
  let current: Pt[] = [];
  let cursor: Pt = { x: 0, y: 0 };

  for (const cmd of path.commands) {
    switch (cmd.type) {
      case "M":
        if (current.length > 2) contours.push(current);
        cursor = { x: cmd.x, y: cmd.y };
        current = [cursor];
        break;
      case "L":
        cursor = { x: cmd.x, y: cmd.y };
        current.push(cursor);
        break;
      case "Q": {
        const qPts = sampleQuadBezier(
          cursor,
          { x: cmd.x1, y: cmd.y1 },
          { x: cmd.x, y: cmd.y },
        );
        current.push(...qPts);
        cursor = { x: cmd.x, y: cmd.y };
        break;
      }
      case "C": {
        const cPts = sampleCubicBezier(
          cursor,
          { x: cmd.x1, y: cmd.y1 },
          { x: cmd.x2!, y: cmd.y2! },
          { x: cmd.x, y: cmd.y },
        );
        current.push(...cPts);
        cursor = { x: cmd.x, y: cmd.y };
        break;
      }
      case "Z":
        if (current.length > 2) contours.push(current);
        current = [];
        break;
    }
  }
  if (current.length > 2) contours.push(current);

  return contours;
}

/**
 * Build an OpenCascade compound of planar faces from text contours.
 * The faces lie in the plane y = yPlane, with opentype X → OC X and
 * opentype Y → OC Z (so the text reads correctly from below the tag).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function contoursToFlatShape(oc: any, contours: Pt[][], yPlane: number): any {
  const classified = contours.map((pts) => ({
    pts,
    area: signedArea(pts),
  }));

  // Outer contours have positive signed area, holes have negative.
  const outers = classified.filter((c) => c.area > 0);
  const inners = classified.filter((c) => c.area <= 0);

  function makeWire(pts: Pt[]) {
    const mkWire = new oc.BRepBuilderAPI_MakeWire_1();
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      if (Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y) < 1e-6) continue;
      const p1 = new oc.gp_Pnt_3(pts[i].x, yPlane, pts[i].y);
      const p2 = new oc.gp_Pnt_3(pts[j].x, yPlane, pts[j].y);
      const seg = new oc.GC_MakeSegment_1(p1, p2);
      const edge = new oc.BRepBuilderAPI_MakeEdge_24(
        new oc.Handle_Geom_Curve_2(seg.Value().get()),
      );
      mkWire.Add_1(edge.Edge());
    }
    return mkWire.Wire();
  }

  const builder = new oc.BRep_Builder();
  const compound = new oc.TopoDS_Compound();
  builder.MakeCompound(compound);

  for (const outer of outers) {
    const outerWire = makeWire(outer.pts);
    const mkFace = new oc.BRepBuilderAPI_MakeFace_15(outerWire, true);

    // Add inner contours (holes) that fall inside this outer contour
    for (const inner of inners) {
      if (pointInPolygon(inner.pts[0], outer.pts)) {
        mkFace.Add(makeWire(inner.pts));
      }
    }

    builder.Add(compound, mkFace.Face());
  }

  return compound;
}

export function registerCadHandlers(): void {
  // Begin loading OpenCascade immediately — the WASM compilation runs in
  // parallel with renderer startup so it's already done (or nearly done)
  // by the time the first IPC call arrives.
  getOC();

  ipcMain.handle("cad:build-hello-world", async () => {
    const oc = await getOC();

    const box = new oc.BRepPrimAPI_MakeBox_2(1, 1, 1);
    const sphere = new oc.BRepPrimAPI_MakeSphere_5(
      new oc.gp_Pnt_3(0.5, 0.5, 0.5),
      0.65,
    );
    const cut = new oc.BRepAlgoAPI_Cut_3(
      box.Shape(),
      sphere.Shape(),
      new oc.Message_ProgressRange_1(),
    );
    cut.Build(new oc.Message_ProgressRange_1());

    return shapeToMesh(oc, cut.Shape());
  });

  ipcMain.handle(
    "cad:build-seal-tag",
    async (_event, width, depth, height, text?: string) => {
      const oc = await getOC();

      const aPnt1 = new oc.gp_Pnt_3(-width / 2, 0, -depth / 2);
      const aPnt2 = new oc.gp_Pnt_3(-width / 2, height, 0);
      const aPnt3 = new oc.gp_Pnt_3(-width / 2, 0, depth / 2);

      const aSegment1 = new oc.GC_MakeSegment_1(aPnt2, aPnt1);
      const aSegment2 = new oc.GC_MakeSegment_1(aPnt3, aPnt2);
      const aSegment3 = new oc.GC_MakeSegment_1(aPnt1, aPnt3);

      // Profile : Define the Topology
      const anEdge1 = new oc.BRepBuilderAPI_MakeEdge_24(
        new oc.Handle_Geom_Curve_2(aSegment1.Value().get()),
      );
      const anEdge2 = new oc.BRepBuilderAPI_MakeEdge_24(
        new oc.Handle_Geom_Curve_2(aSegment2.Value().get()),
      );
      const anEdge3 = new oc.BRepBuilderAPI_MakeEdge_24(
        new oc.Handle_Geom_Curve_2(aSegment3.Value().get()),
      );
      const aWire = new oc.BRepBuilderAPI_MakeWire_4(
        anEdge1.Edge(),
        anEdge2.Edge(),
        anEdge3.Edge(),
      );

      const mkWire = new oc.BRepBuilderAPI_MakeWire_1();
      mkWire.Add_2(aWire.Wire());
      const myWireProfile = mkWire.Wire();

      // Body : Prism the Profile
      const myFaceProfile = new oc.BRepBuilderAPI_MakeFace_15(
        myWireProfile,
        false,
      );
      const aPrismVec = new oc.gp_Vec_4(width, 0, 0);
      let myBody = new oc.BRepPrimAPI_MakePrism_1(
        myFaceProfile.Face(),
        aPrismVec,
        false,
        true,
      );

      // Body : Apply Fillets
      const mkFillet = new oc.BRepFilletAPI_MakeFillet(
        myBody.Shape(),
        oc.ChFi3d_FilletShape.ChFi3d_Rational,
      );
      const anEdgeExplorer = new oc.TopExp_Explorer_2(
        myBody.Shape(),
        oc.TopAbs_ShapeEnum.TopAbs_EDGE,
        oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
      );
      while (anEdgeExplorer.More()) {
        const anEdge = oc.TopoDS.Edge_1(anEdgeExplorer.Current());
        mkFillet.Add_2(0.2, anEdge);
        anEdgeExplorer.Next();
      }

      myBody = mkFillet.Shape();

      // --- Engrave text on the bottom face (y = 0) ---
      if (text && text.length > 0) {
        try {
          const fontSize = Math.min(
            (width * 0.8) / (text.length * 0.6),
            depth * 0.4,
          );

          const contours = textToContours(text, fontSize);
          console.log("Text contours:", contours.length);

          if (contours.length > 0) {
            // Place text slightly below y = 0 so the extruded tool cleanly
            // penetrates the bottom face of the tag body.
            const offset = 0.1;
            const engraveDepth = Math.max(height * 0.1, 0.05);
            const textFaces = contoursToFlatShape(oc, contours, -offset);

            // Extrude upward through the bottom face and into the body
            const extrudeVec = new oc.gp_Vec_4(0, offset + engraveDepth, 0);
            const extrudedText = new oc.BRepPrimAPI_MakePrism_1(
              textFaces,
              extrudeVec,
              false,
              true,
            );

            const textCut = new oc.BRepAlgoAPI_Cut_3(
              myBody,
              extrudedText.Shape(),
              new oc.Message_ProgressRange_1(),
            );
            textCut.Build(new oc.Message_ProgressRange_1());

            if (!textCut.HasErrors()) {
              myBody = textCut.Shape();
            } else {
              console.error("Text boolean cut reported errors");
            }
          }
        } catch (e) {
          console.error("Text engraving failed:", e);
        }
      }

      return shapeToMesh(oc, myBody);
    },
  );
}
