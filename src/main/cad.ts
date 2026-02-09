import { ipcMain } from "electron";
import fs from "fs";
import path from "path";

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

// Cache: load a font into the Emscripten virtual FS once.
let fontLoaded = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ensureFont(oc: any): void {
  if (fontLoaded) return;
  const hostPath = findSystemFont();
  const fontData = fs.readFileSync(hostPath);
  try {
    oc.FS.mkdir("/fonts");
  } catch {
    /* directory already exists */
  }
  oc.FS.writeFile("/fonts/default.ttf", new Uint8Array(fontData));
  fontLoaded = true;
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

    return shapeToMesh(oc,cut.Shape());
  });

  ipcMain.handle("cad:build-seal-tag", async (event, width, depth, height, text?: string) => {
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
      // Add edge to fillet algorithm
      mkFillet.Add_2(0.2, anEdge);
      anEdgeExplorer.Next();
    }

    /*
    // get the group
    Handle(Graphic3d_Group) aGroup = thePrs->NewGroup();
    // change the text aspect
    Handle(Graphic3d_AspectText3d) aTextAspect = new
    Graphic3d_AspectText3d();
    aTextAspect->SetTextZoomable (true);
    aTextAspect->SetTextAngle (45.0);
    aGroup->SetPrimitivesAspect (aTextAspect);
    // add a text primitive to the structure
    Graphic3d_Vertex aPoint (1, 1, 1);
    aGroup->Text (Standard_CString ("Text"), aPoint, 16.0)
    */

    myBody = mkFillet.Shape();

    // --- Engrave text on the bottom face (y = 0) ---
    if (text && text.length > 0) {
      ensureFont(oc);

      // Scale font so the text fits within ~80 % of the bottom face width
      const fontSize = Math.min(
        (width * 0.8) / (text.length * 0.6),
        depth * 0.4,
      );
      const fontPath = new oc.NCollection_Utf8String_4(
        "/fonts/default.ttf",
        -1,
      );
      const brepFont = new oc.StdPrs_BRepFont_2(fontPath, fontSize, 0);

      const textBuilder = new oc.StdPrs_BRepTextBuilder();
      const textStr = new oc.NCollection_Utf8String_4(text, -1);

      // Coordinate system: text lies on y = 0, readable from below
      const penOrigin = new oc.gp_Pnt_3(0, -0.01, 0);
      const penN = new oc.gp_Dir_4(0, -1, 0); // normal faces down
      const penX = new oc.gp_Dir_4(1, 0, 0); // reading direction
      const penLoc = new oc.gp_Ax3_3(penOrigin, penN, penX);

      const textShape = textBuilder.Perform_2(
        brepFont,
        textStr,
        penLoc,
        oc.Graphic3d_HorizontalTextAlignment.Graphic3d_HTA_CENTER,
        oc.Graphic3d_VerticalTextAlignment.Graphic3d_VTA_CENTER,
      );

      // Extrude flat text upward into the body, then cut
      const engraveDepth = Math.max(height * 0.05, 0.02);
      const extrudeVec = new oc.gp_Vec_4(0, engraveDepth + 0.01, 0);
      const extrudedText = new oc.BRepPrimAPI_MakePrism_1(
        textShape,
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
      myBody = textCut.Shape();
    }

    return shapeToMesh(oc, myBody);
  });
}
