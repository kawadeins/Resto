import "express-session";

declare module "express-session" {
  interface SessionData {
    userEmail?: string;
    role?: string;
    restaurantId?: number;
    csrfToken?: string;
    oauthState?: string;
  }
}
