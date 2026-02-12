import { useState } from "react";
import { Button, CircularProgress, Stack, TextField } from "@mui/material";
import type { TagParams } from "./ThreeCanvas";

interface ControlsProps {
  onUpdate: (params: TagParams) => void;
  loading?: boolean;
}

export default function Controls({ onUpdate, loading }: ControlsProps) {
  const [width, setWidth] = useState(40);
  const [depth, setDepth] = useState(40);
  const [height, setHeight] = useState(15);
  const [textHeight, setTextHeight] = useState(4);
  const [text, setText] = useState("foo");

  return (
    <Stack direction="column" spacing={2}>
      <TextField
        label="Width"
        type="number"
        size="small"
        defaultValue={width}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (v) setWidth(v);
        }}
      />
      <TextField
        label="Depth"
        type="number"
        size="small"
        defaultValue={depth}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (v) setDepth(v);
        }}
      />
      <TextField
        label="Height"
        type="number"
        size="small"
        defaultValue={height}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (v) setHeight(v);
        }}
      />
      <TextField
        label="Tag text"
        size="small"
        defaultValue={text}
        onChange={(e) => setText(e.target.value)}
      />
      <TextField
        label="Text Height"
        type="number"
        size="small"
        defaultValue={textHeight}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (v) setTextHeight(v);
        }}
      />
      <Button
        variant="contained"
        onClick={() => onUpdate({ width, depth, height, text, textHeight })}
      >
        Update
      </Button>

      {loading ? (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="center"
        >
          <CircularProgress />
        </Stack>
      ) : (
        <Button
          variant="contained"
          onClick={() => window.electronAPI.triggerExportSTL()}
        >
          Save STL
        </Button>
      )}
    </Stack>
  );
}
