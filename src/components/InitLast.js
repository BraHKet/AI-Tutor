import { useEffect } from "react";

function InitLast({ onInit }) {
  useEffect(() => {
    onInit?.();
  }, [onInit]);

  return null; // non deve renderizzare nulla
}

export default InitLast;
