// Helpers to convert OpenCascade shapes to GLB blob URLs for Three.js loading.
// Adapted from https://ocjs.org/docs/getting-started/hello-world

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OC = any

export function visualizeDoc(oc: OC, doc: OC): string {
  const cafWriter = new oc.RWGltf_CafWriter(
    new oc.TCollection_AsciiString_2("./file.glb"),
    true
  )
  cafWriter.Perform_2(
    new oc.Handle_TDocStd_Document_2(doc),
    new oc.TColStd_IndexedDataMapOfStringString_1(),
    new oc.Message_ProgressRange_1()
  )

  const glbFile = oc.FS.readFile("./file.glb", { encoding: "binary" })
  return URL.createObjectURL(
    new Blob([glbFile.buffer], { type: "model/gltf-binary" })
  )
}

export function visualizeShapes(oc: OC, shapes: OC | OC[]): string {
  const shapesArray = Array.isArray(shapes) ? shapes : [shapes]
  const doc = new oc.TDocStd_Document(
    new oc.TCollection_ExtendedString_1()
  )
  const shapeTool = oc.XCAFDoc_DocumentTool.ShapeTool(doc.Main()).get()

  for (const s of shapesArray) {
    shapeTool.SetShape(shapeTool.NewShape(), s)
    new oc.BRepMesh_IncrementalMesh_2(s, 0.1, false, 0.1, false)
  }

  return visualizeDoc(oc, doc)
}
