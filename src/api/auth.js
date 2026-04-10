import { http, setAccessToken, setUser } from "./client.js";

export const authApi = {
  async register({
    firstName,
    lastName,
    email,
    phone,
    password,
    maintenanceAnnouncementsEnabled,
    turnstileToken,
    role = "user",
  }) {
    const data = await http("/auth/register", {
      method: "POST",
      body: {
        firstName,
        lastName,
        email,
        phone,
        password,
        maintenanceAnnouncementsEnabled,
        turnstileToken,
        role,
      },
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data;
  },
  async login({ email, password, turnstileToken }) {
    const data = await http("/auth/login", {
      method: "POST",
      body: { email, password, turnstileToken },
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data;
  },
  async me() {
    const data = await http("/auth/me", { auth: true });
    if (data?.user) setUser(data.user);
    return data?.user || null;
  },
  async logout() {
    try {
      await http("/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    setUser(null);
  },
};
