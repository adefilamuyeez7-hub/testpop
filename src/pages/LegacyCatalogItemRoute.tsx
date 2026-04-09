import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { getProductsByCreativeRelease } from "@/lib/db";

type LegacyCatalogItemRouteProps = {
  forcedType?: "drop" | "product" | "release";
};

export default function LegacyCatalogItemRoute({ forcedType }: LegacyCatalogItemRouteProps) {
  const navigate = useNavigate();
  const params = useParams<{ type: "drop" | "product" | "release"; id: string }>();
  const type = forcedType || params.type;
  const id = params.id;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!type || !id) {
      navigate("/discover", { replace: true });
      return;
    }

    if (type === "drop") {
      navigate(`/drops/${id}`, { replace: true });
      return;
    }

    if (type === "product") {
      navigate(`/products/${id}`, { replace: true });
      return;
    }

    let active = true;

    async function resolveReleaseRoute() {
      try {
        const products = await getProductsByCreativeRelease(id);
        const product = products.find((candidate) => Boolean(candidate?.id)) || null;

        if (!active) return;

        if (product?.id) {
          navigate(`/products/${product.id}`, { replace: true });
          return;
        }

        navigate("/discover", { replace: true });
      } catch (routeError) {
        if (!active) return;
        setError(routeError instanceof Error ? routeError.message : "Unable to open this release.");
      }
    }

    void resolveReleaseRoute();

    return () => {
      active = false;
    };
  }, [id, navigate, type]);

  if (!type || !id) {
    return <Navigate to="/discover" replace />;
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white px-6 py-8 text-center shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)]">
        {error ? (
          <>
            <p className="text-lg font-semibold text-slate-950">This release moved.</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{error}</p>
            <button
              type="button"
              onClick={() => navigate("/discover", { replace: true })}
              className="mt-5 inline-flex h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Open Discover
            </button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-500" />
            <p className="mt-3 text-sm text-slate-600">Opening this collectible in the new discover flow...</p>
          </>
        )}
      </div>
    </div>
  );
}
