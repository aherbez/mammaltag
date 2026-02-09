import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  AppBar,
  Stack,
  Toolbar,
  Typography,
  Box,
  Button,
} from "@mui/material";
import ThreeCanvas from "./ThreeCanvas";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

/*
  <AppBar position="static">
    <Toolbar variant="dense">
      <Typography variant="h6">mammaltag</Typography>
    </Toolbar>
  </AppBar>
*/

export default function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <Stack direction="row" sx={{ flex: 1 }}>
          <Box sx={{ flex: 1, overflow: "hidden", position: "relative" }}>
            <ThreeCanvas />
          </Box>
          <Stack direction="column" sx={{ width: 300, p: 2, gap: 2 }}>
            <Typography variant="h6">Controls</Typography>
            {/* Add your controls here */}
            <Button
              onClick={() => {
                console.log("updating...");
              }}
            >
              Update
            </Button>
          </Stack>
        </Stack>
      </Box>
    </ThemeProvider>
  );
}
