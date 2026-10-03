import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "../../../packages/ui/src/tokens.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root-element ontbreekt.");
createRoot(root).render(<App />);
