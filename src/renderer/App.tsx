import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  AppBar,
  Stack,
  Toolbar,
  Typography,
  Box,
} from "@mui/material";
import ThreeCanvas from "./ThreeCanvas";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

export default function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <AppBar position="static">
          <Toolbar variant="dense">
            <Typography variant="h6">mammaltag</Typography>
          </Toolbar>
        </AppBar>
        <Stack direction="row" sx={{ flex: 1 }}>
          <Box sx={{ flex: 1, overflow: "hidden", position: "relative" }}>
            <ThreeCanvas />
          </Box>
          <Stack direction="column" sx={{ width: 300, p: 2, gap: 2 }}>
            <Typography variant="h6">Controls</Typography>
            {/* Add your controls here */}
          </Stack>
        </Stack>
      </Box>
    </ThemeProvider>
  );
}
