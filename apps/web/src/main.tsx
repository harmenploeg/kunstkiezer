import { AuthProvider, useAuth } from "./features/account/AuthContext.tsx";
import { ProfileProvider } from "./features/profile/useProfile.ts";
import { VisitsProvider } from "./features/visits/Visits.tsx";
import { RecommendationProvider } from "./features/ranking/RecommendationContext.tsx";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "../../../packages/ui/src/tokens.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root-element ontbreekt.");
function Workspace() {
  const auth = useAuth();
  return (
    <ProfileProvider
      key={auth.loading ? "loading" : (auth.user?.id ?? "guest")}
    >
      <VisitsProvider>
        <RecommendationProvider>
          <App />
        </RecommendationProvider>
      </VisitsProvider>
    </ProfileProvider>
  );
}
createRoot(root).render(
  <AuthProvider>
    <Workspace />
  </AuthProvider>,
);
