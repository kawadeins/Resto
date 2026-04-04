import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Login() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/");
  }, [setLocation]);
  return null;
}
