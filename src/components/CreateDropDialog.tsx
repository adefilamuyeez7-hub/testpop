import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, Image, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useCreateDrop, useWallet } from "@/hooks/useContracts";
import { Web3Error } from "@/lib/types";
import { ART_DROP_ADDRESS } from "@/lib/contracts/artDrop";
import { uploadFileToPinata, uploadMetadataToPinata } from "@/lib/pinata";

const steps = ["Upload Art", "Details", "Mint & Publish"];
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const isArtDropConfigured = ART_DROP_ADDRESS !== ZERO_ADDRESS;

const CreateDropDialog = () => {
  const { isConnected, connectWallet } = useWallet();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { createDrop, isPending, isConfirming, isSuccess, error } = useCreateDrop();

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    duration: "24",
    supply: "1",
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleMint = async () => {
    if (!selectedFile) return;
    if (isArtDropConfigured && !isConnected) {
      connectWallet();
      return;
    }
    setIsUploading(true);
    setUploadError(null);

    try {
      // Validate form inputs
      if (!form.title || form.title.trim().length === 0) {
        throw new Error("Title is required");
      }
      if (!form.price || form.price.trim().length === 0) {
        throw new Error("Price is required");
      }
      if (parseFloat(form.price) <= 0) {
        throw new Error("Price must be greater than 0");
      }
      if (!form.duration || parseInt(form.duration) <= 0) {
        throw new Error("Duration must be greater than 0");
      }
      if (!form.supply || parseInt(form.supply) <= 0) {
        throw new Error("Supply must be greater than 0");
      }

      console.log("📤 Starting upload process...", { title: form.title, price: form.price, duration: form.duration });

      toast.info("Uploading artwork to IPFS…");
      const imageCid = await uploadFileToPinata(selectedFile);
      const imageUri = `ipfs://${imageCid}`;
      console.log("✅ Image uploaded:", imageUri);

      toast.info("Pinning metadata…");
      const metadataUri = await uploadMetadataToPinata({
        name: form.title,
        description: form.description,
        image: imageUri,
        attributes: [
          { trait_type: "Supply", value: form.supply },
          { trait_type: "Duration (hours)", value: form.duration },
        ],
      });
      console.log("✅ Metadata pinned:", metadataUri);

      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + Number(form.duration) * 3600;
      
      console.log("⏰ Times:", { startTime, endTime, durationSeconds: endTime - startTime });

      if (!isArtDropConfigured) {
        toast.error("ArtDrop contract address not configured. Cannot create drop.");
        setOpen(false);
        return;
      }

      try {
        console.log("🚀 Calling contract createDrop...");
        await createDrop(metadataUri, form.price, Number(form.supply), startTime, endTime);
      } catch (contractError: unknown) {
        const errorMessage = contractError instanceof Error ? contractError.message : "Contract call failed";
        console.error("❌ Contract error:", errorMessage, contractError);
        setUploadError(errorMessage);
        toast.error(errorMessage);
        setIsUploading(false);
        return;
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Upload failed";
      console.error("❌ Error:", errorMessage, err);
      setUploadError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (isSuccess) {
      setUploadError(null);
      toast.success("Art minted on Base! 🎉");
    }
  }, [isSuccess]);

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setStep(0);
      setImagePreview(null);
      setSelectedFile(null);
      setIsUploading(false);
      setUploadError(null);
      setForm({ title: "", description: "", price: "", duration: "24", supply: "1" });
    }, 300);
  };

  const canProceed =
    step === 0 ? !!imagePreview : step === 1 ? !!(form.title && form.price) : true;

  const isMinted = isSuccess;
  const isMinting = isUploading || isPending || isConfirming;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full rounded-xl gradient-primary text-primary-foreground font-semibold">
          <Plus className="h-4 w-4 mr-2" /> Create New Drop
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm mx-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Create Drop</DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                    i <= step ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                <span className={`text-[10px] font-medium ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>
                  {s}
                </span>
                {i < steps.length - 1 && <div className="w-4 h-px bg-border" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {step === 0 && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              {imagePreview ? (
                <div className="relative rounded-xl overflow-hidden aspect-square bg-secondary">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    onClick={() => {
                      setImagePreview(null);
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-sm text-xs font-semibold"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-square rounded-xl border-2 border-dashed border-border bg-secondary/50 flex flex-col items-center justify-center gap-3 hover:bg-secondary transition-colors"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">Upload your artwork</p>
                    <p className="text-xs text-muted-foreground font-body">PNG, JPG, GIF, MP4 · Max 10MB</p>
                  </div>
                </button>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div className="flex gap-3">
                {imagePreview && (
                  <div className="h-16 w-16 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <div>
                    <Label className="text-xs">Title</Label>
                    <Input
                      placeholder="e.g. Chromatic Dreams"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="h-9 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea
                  placeholder="Tell collectors about this piece..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="rounded-lg text-sm min-h-[60px]"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Price (ETH)</Label>
                  <Input
                    placeholder="0.1"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="h-9 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Duration (hrs)</Label>
                  <Input
                    placeholder="24"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    className="h-9 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Supply</Label>
                  <Input
                    placeholder="1"
                    value={form.supply}
                    onChange={(e) => setForm({ ...form, supply: e.target.value })}
                    className="h-9 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-xl bg-secondary/50 p-3 space-y-2">
                <div className="flex gap-3">
                  {imagePreview && (
                    <div className="h-20 w-20 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-foreground">{form.title}</p>
                    <p className="text-xs text-muted-foreground font-body line-clamp-2">{form.description}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary" className="text-[10px]">{form.price} ETH</Badge>
                      <Badge variant="secondary" className="text-[10px]">{form.duration}h</Badge>
                      <Badge variant="secondary" className="text-[10px]">×{form.supply}</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-card border border-border p-3 space-y-2 text-xs font-body">
                <div className="flex justify-between text-muted-foreground">
                  <span>Network</span>
                  <span className="font-semibold text-foreground">Base Sepolia</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Storage</span>
                  <span className="font-semibold text-foreground">IPFS via Pinata</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Platform Fee</span>
                  <span className="font-semibold text-foreground">2.5%</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Blockchain</span>
                  <span className="font-semibold text-foreground">
                    {isArtDropConfigured ? "On-chain" : "Not configured"}
                  </span>
                </div>
              </div>

              {uploadError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{uploadError}</p>
                </div>
              )}

              {error && !isSuccess && (
                <p className="text-xs text-destructive">
                  {(error as Web3Error).shortMessage || (error as Web3Error).message || "Transaction failed"}
                </p>
              )}

              {isMinted ? (
                <div className="text-center py-4">
                  <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-2" />
                  <p className="font-bold text-foreground">Successfully Minted!</p>
                  <p className="text-xs text-muted-foreground font-body mt-1">Your drop is now live on Base</p>
                </div>
              ) : (
                <Button
                  onClick={handleMint}
                  disabled={isMinting}
                  className="w-full rounded-xl gradient-primary text-primary-foreground font-bold h-11"
                >
                  {isUploading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading to IPFS…</>
                  ) : isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirm in wallet…</>
                  ) : isConfirming ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Minting on Base…</>
                  ) : (
                    <><Image className="h-4 w-4 mr-2" /> {isArtDropConfigured ? "Mint & Publish Drop" : "Upload Draft Drop"}</>
                  )}
                </Button>
              )}
            </div>
          )}

          {!isMinted && (
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" size="sm" className="rounded-xl flex-1" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              {step < 2 && (
                <Button
                  size="sm"
                  className="rounded-xl flex-1 gradient-primary text-primary-foreground font-semibold"
                  disabled={!canProceed}
                  onClick={() => setStep(step + 1)}
                >
                  Continue
                </Button>
              )}
            </div>
          )}

          {isMinted && (
            <Button variant="outline" className="w-full rounded-xl" onClick={handleClose}>
              Done
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDropDialog;
