import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/hooks/useContracts";
import {
  submitArtistApplication,
  getArtistApplication,
  type ArtistApplicationInsert,
} from "@/lib/db";
import { validateApplicationData } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet } from "lucide-react";

const ART_TYPES = [
  "Digital Art",
  "Photography",
  "Music",
  "Video",
  "Illustration",
  "3D Modeling",
  "Animation",
  "Design",
  "NFT Art",
  "Mixed Media",
  "Sculpture",
  "Performance",
];

type ApplicationStatus = "pending" | "approved" | "rejected" | null;

const DEFAULT_FORM = {
  artist_name: "",
  email: "",
  bio: "",
  art_types: [] as string[],
  twitter_url: "",
  instagram_url: "",
  website_url: "",
  portfolio_url: "",
  terms_agreed: false,
};

export default function ArtistApplicationPage() {
  const navigate = useNavigate();
  const { address, isConnected, isConnecting, connectWallet } = useWallet();
  const { toast } = useToast();

  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  // ── Check existing application on wallet connect ─────────────────────────
  useEffect(() => {
    if (!address) return;

    const checkStatus = async () => {
      setCheckingStatus(true);
      try {
        const existing = await getArtistApplication(address);
        if (existing) {
          setApplicationStatus(existing.status as ApplicationStatus);
          setFormData({
            artist_name: existing.artist_name || "",
            email: existing.email || "",
            bio: existing.bio || "",
            art_types: existing.art_types || [],
            twitter_url: existing.twitter_url || "",
            instagram_url: existing.instagram_url || "",
            website_url: existing.website_url || "",
            portfolio_url: existing.portfolio_url || "",
            terms_agreed: existing.terms_agreed || false,
          });
          setSubmitted(true);
        }
      } catch (err) {
        console.error("Could not check application status:", err);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkStatus();
  }, [address]);

  // ── Input handlers ────────────────────────────────────────────────────────
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleArtTypeToggle = (type: string) => {
    setFormData((prev) => ({
      ...prev,
      art_types: prev.art_types.includes(type)
        ? prev.art_types.filter((t) => t !== type)
        : [...prev.art_types, type],
    }));
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address || !isConnected) {
      toast({ title: "Error", description: "Please connect your wallet first.", variant: "destructive" });
      return;
    }

    // Client-side Zod validation before hitting the DB
    let validated: ArtistApplicationInsert;
    try {
      validated = validateApplicationData({
        ...formData,
        wallet_address: address,
      }) as ArtistApplicationInsert;
    } catch (err: any) {
      toast({ title: "Invalid Information", description: err.message, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const result = await submitArtistApplication(validated);

      if (!result?.id) {
        throw new Error("Application submitted but could not be verified.");
      }

      setSubmitted(true);
      setApplicationStatus("pending");
      setShowSuccessDialog(true);

      toast({
        title: "Application Submitted!",
        description: "We'll review it shortly and be in touch.",
      });
    } catch (err: any) {
      console.error("Application error:", err);

      if (err?.message?.includes("already submitted")) {
        toast({
          title: "Already Applied",
          description: "You've already submitted an application from this wallet.",
          variant: "destructive",
        });
        setApplicationStatus("pending");
        setSubmitted(true);
      } else {
        toast({
          title: "Submission Failed",
          description: err?.message || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Approved state ────────────────────────────────────────────────────────
  if (applicationStatus === "approved") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-20">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="text-4xl mb-4">✨</div>
            <CardTitle className="text-2xl">Welcome to POPUP!</CardTitle>
            <CardDescription>Your application has been approved.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              Head to your artist studio to set up your profile and start creating drops.
            </p>
            <Button className="w-full" onClick={() => navigate("/studio")}>
              Open Artist Studio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Pending / rejected state ──────────────────────────────────────────────
  if (submitted && applicationStatus) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-20">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="text-4xl mb-4">
              {applicationStatus === "pending" ? "⏳" : "❌"}
            </div>
            <CardTitle className="text-2xl">
              {applicationStatus === "pending" ? "Application Pending" : "Application Rejected"}
            </CardTitle>
            <CardDescription>
              {applicationStatus === "pending"
                ? "We're reviewing your application and will be in touch soon."
                : "Your application wasn't approved this time around."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {applicationStatus === "pending" && (
              <>
                <p className="text-center text-sm text-muted-foreground">
                  Keep your portfolio up to date while you wait — we'll email you with our decision.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.location.reload()}
                >
                  Refresh Status
                </Button>
              </>
            )}
            {applicationStatus === "rejected" && (
              <p className="text-center text-sm text-muted-foreground">
                You're welcome to reapply in the future. Keep creating!
              </p>
            )}
            <Button variant="ghost" className="w-full" onClick={() => navigate("/")}>
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">

      {/* Header */}
      <div className="border-b bg-background sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Apply to POPUP</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Join our curated community of independent artists
            </p>
          </div>
          {!isConnected && (
            <Button
              size="sm"
              onClick={connectWallet}
              disabled={isConnecting}
              className="rounded-full gap-2"
            >
              <Wallet className="h-3.5 w-3.5" />
              {isConnecting ? "Connecting…" : "Connect"}
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* Wallet gate */}
        {!isConnected ? (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <Wallet className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-6">
                Connect your wallet to start your application.
              </p>
              <Button onClick={connectWallet} disabled={isConnecting}>
                {isConnecting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting…</>
                ) : (
                  <><Wallet className="h-4 w-4 mr-2" /> Connect Wallet</>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : checkingStatus ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Connected wallet */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary px-4 py-2.5 rounded-lg w-fit">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              Applying as{" "}
              <span className="font-mono">{address?.slice(0, 8)}…{address?.slice(-6)}</span>
            </div>

            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Basic Information</CardTitle>
                <CardDescription>Tell us who you are</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="artist_name">
                    Artist Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="artist_name"
                    name="artist_name"
                    placeholder="Your artist or stage name"
                    value={formData.artist_name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="bio">
                    Bio <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="bio"
                    name="bio"
                    placeholder="Tell us about your work, creative process, and what you want to build on POPUP…"
                    value={formData.bio}
                    onChange={handleInputChange}
                    rows={4}
                    required
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {formData.bio.length}/1000
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Art Types */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Art Type <span className="text-destructive">*</span>
                </CardTitle>
                <CardDescription>Select everything that applies to your practice</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {ART_TYPES.map((type) => (
                    <div
                      key={type}
                      className="flex items-center space-x-2 cursor-pointer"
                      onClick={() => handleArtTypeToggle(type)}
                    >
                      <Checkbox
                        id={`art-${type}`}
                        checked={formData.art_types.includes(type)}
                        onCheckedChange={() => handleArtTypeToggle(type)}
                      />
                      <label htmlFor={`art-${type}`} className="text-sm cursor-pointer">
                        {type}
                      </label>
                    </div>
                  ))}
                </div>

                {formData.art_types.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {formData.art_types.map((type) => (
                      <Badge key={type} variant="secondary">
                        {type}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Social Links */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Links</CardTitle>
                <CardDescription>Optional — helps us verify your work</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {[
                  { id: "twitter_url", label: "Twitter / X", placeholder: "https://twitter.com/yourhandle" },
                  { id: "instagram_url", label: "Instagram", placeholder: "https://instagram.com/yourhandle" },
                  { id: "website_url", label: "Website", placeholder: "https://your-website.com" },
                  { id: "portfolio_url", label: "Portfolio", placeholder: "https://your-portfolio.com" },
                ].map(({ id, label, placeholder }) => (
                  <div key={id} className="space-y-1.5">
                    <Label htmlFor={id}>{label}</Label>
                    <Input
                      id={id}
                      name={id}
                      placeholder={placeholder}
                      value={formData[id as keyof typeof formData] as string}
                      onChange={handleInputChange}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Terms */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="terms"
                    checked={formData.terms_agreed}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, terms_agreed: !!checked }))
                    }
                  />
                  <label htmlFor="terms" className="text-sm cursor-pointer leading-relaxed">
                    I agree to the POPUP terms and conditions. I confirm that my artwork is
                    original and I have the rights to distribute it.{" "}
                    <span className="text-destructive">*</span>
                  </label>
                </div>
              </CardContent>
            </Card>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading || !formData.terms_agreed || formData.art_types.length === 0}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</>
              ) : (
                "Submit Application"
              )}
            </Button>
          </form>
        )}
      </div>

      {/* Success dialog */}
      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Application Submitted! 🎉</AlertDialogTitle>
            <AlertDialogDescription>
              Thank you for applying to POPUP. Our team will review your application and
              get back to you via email. In the meantime, keep creating!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Stay Here</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/")}>
              Back to Home
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
