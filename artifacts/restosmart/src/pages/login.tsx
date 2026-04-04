import { useEffect } from "react";

export default function Login() {
  useEffect(() => {
    window.location.replace(window.location.origin + "/customer/profile");
  }, []);

  return null;
}
