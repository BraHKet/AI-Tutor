// InitLast.jsx
import { useEffect } from "react";

export default function InitLast({ onInit }) {
  useEffect(() => {
    console.log("[InitLast] mounted -> calling onInit");
    onInit?.();
    // l'array di dipendenze è [onInit] così reagisce correttamente se onInit cambia
  }, [onInit]);

  return null;
}