import { useState } from "react";
import { Button, Stack, TextField } from "@mui/material";
import type { TagParams } from "./ThreeCanvas";

interface ControlsProps {
  onUpdate: (params: TagParams) => void;
}

export default function Controls({ onUpdate }: ControlsProps) {
  const [width, setWidth] = useState(1);
  const [depth, setDepth] = useState(1);
  const [height, setHeight] = useState(1);
  const [text, setText] = useState("");

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
      <Button
        variant="contained"
        onClick={() => onUpdate({ width, depth, height, text })}
      >
        Update
      </Button>
    </Stack>
  );
}
