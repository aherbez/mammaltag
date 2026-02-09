import { ipcMain } from "electron";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapesToGlb(oc: any, shapes: any | any[]): Uint8Array {
  const shapesArray = Array.isArray(shapes) ? shapes : [shapes];
  const doc = new oc.TDocStd_Document(new oc.TCollection_ExtendedString_1());
  const shapeTool = oc.XCAFDoc_DocumentTool.ShapeTool(doc.Main()).get();

  for (const s of shapesArray) {
    shapeTool.SetShape(shapeTool.NewShape(), s);
    new oc.BRepMesh_IncrementalMesh_2(s, 0.1, false, 0.1, false);
  }

  const cafWriter = new oc.RWGltf_CafWriter(
    new oc.TCollection_AsciiString_2("./file.glb"),
    true,
  );
  cafWriter.Perform_2(
    new oc.Handle_TDocStd_Document_2(doc),
    new oc.TColStd_IndexedDataMapOfStringString_1(),
    new oc.Message_ProgressRange_1(),
  );

  return oc.FS.readFile("./file.glb", { encoding: "binary" });
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

    return shapesToGlb(oc, cut.Shape());
  });

  ipcMain.handle("cad:build-seal-tag", async (event, width, depth, height) => {
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
    console.log(myBody);

    /*
    console.log("width", width);
    const box = new oc.BRepPrimAPI_MakeBox_2(width, 1, 1);
    const sphere = new oc.BRepPrimAPI_MakeSphere_5(
      new oc.gp_Pnt_3(0.5, 0.0, 0.5),
      0.65,
    );
    const cut = new oc.BRepAlgoAPI_Cut_3(
      box.Shape(),
      sphere.Shape(),
      new oc.Message_ProgressRange_1(),
    );
    cut.Build(new oc.Message_ProgressRange_1());
    */

    return shapesToGlb(oc, myBody);
  });
}
