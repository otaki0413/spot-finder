import { useEffect } from "react";

export function CiWarning({ value }: { value: string }) {
  useEffect(() => {
    console.log(value);
  }, []);
  return null;
}
