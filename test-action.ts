import { login } from "./src/app/actions/auth";

async function run() {
  try {
    const res = await login({ email: "admin@electify.edu", password: "Admin@12345" });
    console.log(res);
  } catch (e) {
    console.error("Caught error:", e);
  }
}
run();
