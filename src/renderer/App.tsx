import { useEffect, useState } from "react";
import {
  Button,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ThemeProvider,
  createTheme,
  Stack,
  Typography,
  Box,
  Link,
} from "@mui/material";
import ThreeCanvas, { type TagParams } from "./ThreeCanvas";
import Controls from "./Controls";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

const defaultParams: TagParams = {
  width: 40,
  depth: 40,
  height: 15,
  text: "tag",
  textHeight: 1,
};

export default function App() {
  const [tagParams, setTagParams] = useState<TagParams>(defaultParams);
  const [loading, setLoading] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    return window.electronAPI.onShowAbout(() => setAboutOpen(true));
  }, []);

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
            <Typography variant="body2">
              All dimensions are in millimeters.
            </Typography>
            <Controls
              onUpdate={setTagParams}
              defaults={defaultParams}
              loading={loading}
            />
          </Stack>
        </Stack>
      </Box>
      <Dialog open={aboutOpen} onClose={() => setAboutOpen(false)}>
        <DialogTitle>About</DialogTitle>
        <DialogContent>
          <Typography>MammalTag v0.1.0</Typography>
          <Typography variant="body2" color="text.secondary">
            A simple tool for creating custom tags for marine mammal tracking.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Created by Adrian Herbez.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAboutOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}
