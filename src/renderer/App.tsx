import { useState } from "react";
import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  Stack,
  Typography,
  Box,
} from "@mui/material";
import ThreeCanvas, { type TagParams } from "./ThreeCanvas";
import Controls from "./Controls";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

const defaultParams: TagParams = {
  width: 1,
  depth: 1,
  height: 1,
  text: "",
  textHeight: 1,
};

export default function App() {
  const [tagParams, setTagParams] = useState<TagParams>(defaultParams);
  const [loading, setLoading] = useState(false);
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <Stack direction="row" sx={{ flex: 1 }}>
          <Box sx={{ flex: 1, overflow: "hidden", position: "relative" }}>
            <ThreeCanvas tagParams={tagParams} updateLoating={setLoading} />
          </Box>
          <Stack direction="column" sx={{ width: 300, p: 2, gap: 2 }}>
            <Typography variant="h6">Controls</Typography>
            <Controls onUpdate={setTagParams} loading={loading} />
          </Stack>
        </Stack>
      </Box>
    </ThemeProvider>
  );
}
