import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, TrendingUp, Package, Award, Plus, Trash2,
  CheckCircle2, XCircle, ShoppingBag, Truck, MapPin, AlertTriangle,
  Eye, EyeOff, LogOut, Shield, Upload, BarChart3, Loader2, Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/lib/db";
import { useWallet } from "@/hooks/useContracts";
import { ipfsToHttp, uploadFileToPinata } from "@/lib/pinata";
import {
  type ArtistWhitelistEntry as WhitelistEntry,
  getStoredArtistWhitelist,
  getServerArtistWhitelist,
  syncArtistWhitelist,
} from "@/lib/whitelist";
import { getAnalyticsSnapshot, getRecentVisitSeries } from "@/lib/analyticsStore";
import { getAllArtists, getAllDrops, resolveArtistForWallet } from "@/lib/artistStore";
import { validateProductForm, validateFileUpload, isValidWalletAddress, sanitizeString } from "@/lib/validation";
import {
  createProduct as dbCreateProduct,
  addToWhitelist as dbAddToWhitelist,
  deleteWhitelistEntry as dbDeleteWhitelistEntry,
  updateProduct as dbUpdateProduct,
  updateOrder as dbUpdateOrder,
  updateWhitelistEntry as dbUpdateWhitelistEntry,
} from "@/lib/db";
import { useSupabaseAllProducts, useSupabaseAllDrops } from "@/hooks/useSupabase";
import { useApproveArtist } from "@/lib/adminApi";

// ─── Types ────────────────────────────────────────────────────────────────────
type MarketProduct = {
  id: string;
  name: string;
  category: string;
  priceEth: string;
  stock: number;
  sold: number;
  status: "active" | "draft" | "out_of_stock";
  nftLink: string;
  uploadedAt: string;
  description: string;
  image?: string;
  imageUri?: string;
};

type Order = {
  id: string;
  product: string;
  buyer: string;
  qty: number;
  status: "pending" | "shipped" | "delivered" | "cancelled";
  address: string;
  date: string;
  trackingCode: string;
};

type OrderQueryRow = {
  id: string;
  buyer_wallet: string | null;
  quantity: number | string | null;
  status: Order["status"] | null;
  shipping_address: string | null;
  tracking_code: string | null;
  created_at: string | null;
  product_id: string | null;
  products?: { name?: string | null } | { name?: string | null }[] | null;
};

type WhitelistEntryWithContract = WhitelistEntry & {
  contract_address?: string | null;
};

type DropSummary = {
  id: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

// ─── Colour helpers ───────────────────────────────────────────────────────────
const orderColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  shipped: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};
const productColor: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  draft: "bg-secondary text-muted-foreground",
  out_of_stock: "bg-red-100 text-red-800",
};
const whitelistColor: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
};
function normalizeStoredProduct(product: Partial<MarketProduct> & { id?: string; name?: string }): MarketProduct {
  return {
    id: product.id ?? `mp${Date.now()}`,
    name: product.name ?? "Untitled Product",
    category: product.category ?? "Other",
    priceEth: product.priceEth ?? "0",
    stock: Number(product.stock ?? 0),
    sold: Number(product.sold ?? 0),
    status: product.status ?? "draft",
    nftLink: product.nftLink ?? "#",
    uploadedAt: product.uploadedAt ?? new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    description: product.description ?? "",
    image: product.image ?? (product.imageUri ? ipfsToHttp(product.imageUri) : ""),
    imageUri: product.imageUri ?? "",
  };
}

async function saveProductToDBs(product: MarketProduct, creatorWallet: string = "0x0") {
  // Save to Supabase and wait for it
  try {
    console.log(`💾 Saving product to Supabase with creator wallet: ${creatorWallet}`);
    await dbCreateProduct({
      id: product.id,
      creator_wallet: creatorWallet || "0x0",
      name: product.name,
      description: product.description,
      category: product.category,
      price_eth: parseFloat(product.priceEth),
      stock: product.stock,
      sold: product.sold,
      image_url: product.image,
      image_ipfs_uri: product.imageUri,
      status: product.status === "active" ? "published" : product.status,
    });
    console.log(`✅ Product saved to Supabase: ${product.name}`);
  } catch (err) {
    console.error("❌ Product Supabase save failed:", err);
    throw err;
  }
}

// ─── Add Product Dialog ───────────────────────────────────────────────────────
const AddProductDialog = ({ onAdd, adminAddress }: { onAdd: (p: MarketProduct, wallet: string) => Promise<void> | void; adminAddress: string }) => {
  const [open, setOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "", category: "Prints", priceEth: "",
    stock: "1", nftLink: "", description: "",
  });

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (loadEvent) => setImagePreview(loadEvent.target?.result as string);
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setForm({ name: "", category: "Prints", priceEth: "", stock: "1", nftLink: "", description: "" });
    setImageFile(null);
    setImagePreview("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleAdd = async () => {
    // Validate form data
    const validation = validateProductForm({
      name: form.name,
      description: form.description,
      priceEth: form.priceEth,
      stock: Number(form.stock),
      nftLink: form.nftLink,
      category: form.category,
    });

    if (!validation.valid) {
      const errorMsg = Object.values(validation.errors).join(", ");
      console.error("❌ Form validation failed:", errorMsg, validation.errors);
      toast.error(errorMsg);
      return;
    }

    // Validate file upload
    if (!imageFile) {
      console.error("❌ No image file selected");
      toast.error("Product image is required");
      return;
    }

    const fileValidation = validateFileUpload(imageFile);
    if (!fileValidation.valid) {
      console.error("❌ File validation failed:", fileValidation.error);
      toast.error(fileValidation.error || "File upload validation failed");
      return;
    }

    setIsUploading(true);
    try {
      console.log("📤 Starting Pinata upload...");
      const imageCid = await uploadFileToPinata(imageFile);
      console.log("✅ Image uploaded to Pinata:", imageCid);
      
      const imageUri = `ipfs://${imageCid}`;
      const product: MarketProduct = {
        id: `mp${Date.now()}`,
        name: sanitizeString(form.name),
        category: form.category,
        priceEth: form.priceEth,
        stock: Number(form.stock),
        sold: 0,
        status: "draft",
        nftLink: form.nftLink || "#",
        uploadedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        description: sanitizeString(form.description),
        image: ipfsToHttp(imageUri),
        imageUri,
      };
      
      console.log("💾 Product object created:", product);
      
      // Await the onAdd callback so we wait for database save before closing
      console.log("📡 Calling onAdd callback with product and admin address...");
      await Promise.resolve(onAdd(product, adminAddress));
      console.log("✅ Product successfully added!");
      
      toast.success("Product added with Pinata image. Publish when ready.");
      setOpen(false);
      resetForm();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Product upload failed";
      console.error("❌ Product add failed:", errorMessage, error);
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <Button size="sm" className="w-full rounded-xl gradient-primary text-primary-foreground font-semibold" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" /> Add New Product
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle>Add Marketplace Product</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs">Product Image</Label>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-1 w-full rounded-xl border border-dashed border-border bg-secondary/40 p-3 text-left"
              >
                {imagePreview ? (
                  <div className="flex items-center gap-3">
                    <img src={imagePreview} alt="Preview" className="h-16 w-16 rounded-lg object-cover" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{imageFile?.name}</p>
                      <p className="text-xs text-muted-foreground">Tap to replace image</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ImageIcon className="h-4 w-4" />
                    <span className="text-sm">Upload product image</span>
                  </div>
                )}
              </button>
            </div>
            <div>
              <Label className="text-xs">Product Name</Label>
              <Input placeholder="e.g. Signed Print #1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-9 rounded-lg text-sm" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input placeholder="Short description shown on the product page" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="h-9 rounded-lg text-sm" />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm">
                {["Prints", "Apparel", "Sculptures", "Collectibles", "Zines", "Other"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Price (ETH)</Label>
                <Input placeholder="0.05" value={form.priceEth} onChange={e => setForm({ ...form, priceEth: e.target.value })} className="h-9 rounded-lg text-sm" />
              </div>
              <div>
                <Label className="text-xs">Stock Qty</Label>
                <Input type="number" placeholder="10" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="h-9 rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">NFT Link (optional)</Label>
              <Input placeholder="basescan.org/…" value={form.nftLink} onChange={e => setForm({ ...form, nftLink: e.target.value })} className="h-9 rounded-lg text-sm" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={isUploading}>
              {isUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─── Edit Product Dialog ──────────────────────────────────────────────────────
const EditProductDialog = ({ product, onSave }: { product: MarketProduct; onSave: (p: MarketProduct) => void }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...product });

  const handleSave = () => {
    // Validate form data
    const validation = validateProductForm({
      name: form.name,
      description: form.description,
      priceEth: form.priceEth,
      stock: Number(form.stock),
      nftLink: form.nftLink,
      category: form.category,
    });

    if (!validation.valid) {
      toast.error(Object.values(validation.errors).join(", "));
      return;
    }

    onSave({
      ...form,
      name: sanitizeString(form.name),
      description: sanitizeString(form.description),
    });
    toast.success("Product updated");
    setOpen(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-[10px] text-primary underline">Edit</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle>Edit: {product.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs">Product Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-9 rounded-lg text-sm" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="h-9 rounded-lg text-sm" />
            </div>
            <div>
              <Label className="text-xs">Price (ETH)</Label>
              <Input value={form.priceEth} onChange={e => setForm({ ...form, priceEth: e.target.value })} className="h-9 rounded-lg text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Stock</Label>
                <Input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: Number(e.target.value) })} className="h-9 rounded-lg text-sm" />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm">
                  {["Prints", "Apparel", "Sculptures", "Collectibles", "Zines", "Other"].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs">NFT Link</Label>
              <Input value={form.nftLink} onChange={e => setForm({ ...form, nftLink: e.target.value })} className="h-9 rounded-lg text-sm" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─── Update Order Dialog ──────────────────────────────────────────────────────
const UpdateOrderDialog = ({
  order,
  onUpdate,
}: {
  order: Order;
  onUpdate: (id: string, status: Order["status"], code: string) => void | Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Order["status"]>(order.status);
  const [code, setCode] = useState(order.trackingCode);

  const handleSave = () => {
    // Validate tracking code if status is shipped or delivered
    if ((status === "shipped" || status === "delivered") && !code.trim()) {
      toast.error("Tracking code is required for shipped or delivered orders");
      return;
    }

    if (code.trim() && code.length < 3) {
      toast.error("Tracking code must be at least 3 characters");
      return;
    }

    onUpdate(order.id, status, sanitizeString(code.trim()));
    toast.success("Order updated");
    setOpen(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-[10px] text-primary underline">Update</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle>Order {order.id}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="p-3 rounded-xl bg-secondary space-y-1 text-xs text-muted-foreground">
              <p>Product: <span className="font-semibold text-foreground">{order.product}</span></p>
              <p>Buyer: <span className="font-mono">{order.buyer}</span></p>
              <p>Ship to: {order.address}</p>
              <p>Qty: {order.qty}</p>
            </div>
            <div>
              <Label className="text-xs">Delivery Status</Label>
              <select value={status} onChange={e => setStatus(e.target.value as Order["status"])}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm mt-1">
                <option value="pending">Pending</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Tracking Code</Label>
              <Input value={code} onChange={e => setCode(e.target.value)} className="h-9 rounded-lg text-sm" placeholder="TRK-XXX-YY" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─── Main AdminPage ───────────────────────────────────────────────────────────
const AdminPage = () => {
  const { address, disconnect } = useWallet();
  const { data: supabaseProducts, loading: productsLoading } = useSupabaseAllProducts();
  const { data: supabaseDrops } = useSupabaseAllDrops();
  const [activeTab, setActiveTab] = useState("whitelist");

  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>(() => getStoredArtistWhitelist());

  // Load whitelist from Supabase on mount.
  useEffect(() => {
    getServerArtistWhitelist()
      .then(entries => {
        setWhitelist(entries);
        console.log(`✅ Whitelist loaded from Supabase: ${entries.length} entries`);
      })
      .catch(err => {
        console.error("❌ Failed to load whitelist from Supabase, using cache:", err);
      })
  }, []);
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [whitelistFilter, setWhitelistFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [addingArtist, setAddingArtist] = useState(false);
  const [newWallet, setNewWallet] = useState("");
  const [deployingWallet, setDeployingWallet] = useState<string | null>(null);
  const { approve, isLoading: isApproving, error: approvalError } = useApproveArtist();
  const [newName, setNewName] = useState("");
  const [newTag, setNewTag] = useState("Digital Art");

  // Load products from Supabase when available
  useEffect(() => {
    if (supabaseProducts && supabaseProducts.length > 0) {
      console.log(`📖 Loading ${supabaseProducts.length} products from Supabase`);
      const mappedProducts = supabaseProducts.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category || "Other",
        priceEth: String(p.price_eth || 0),
        stock: p.stock || 0,
        sold: p.sold || 0,
        status: (p.status === "published" ? "active" : (p.status as "draft" | "out_of_stock") || "draft") as "active" | "draft" | "out_of_stock",
        nftLink: p.nft_link || "#",
        uploadedAt: new Date(p.created_at || Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        description: p.description || "",
        image: p.image_url || "",
        imageUri: p.image_ipfs_uri || "",
      }));
      setProducts(mappedProducts);
      console.log(`✅ Products loaded: ${mappedProducts.length} items from Supabase`);
    } else {
      setProducts([]);
    }
  }, [supabaseProducts]);

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      const { data, error } = await supabase
        .from("orders")
        .select("id, buyer_wallet, quantity, status, shipping_address, tracking_code, created_at, product_id, products(name)")
        .order("created_at", { ascending: false });

      if (!active) return;

      if (error) {
        console.error("Failed to load orders from Supabase:", error);
        setOrders([]);
        return;
      }

      const mappedOrders = ((data ?? []) as OrderQueryRow[]).map((order) => ({
        id: order.id,
        product: (Array.isArray(order.products) ? order.products[0]?.name : order.products?.name) || order.product_id || "Unknown product",
        buyer: order.buyer_wallet || "Unknown buyer",
        qty: Number(order.quantity || 0),
        status: order.status || "pending",
        address: order.shipping_address || "",
        date: new Date(order.created_at || Date.now()).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        trackingCode: order.tracking_code || "Pending",
      })) as Order[];

      setOrders(mappedOrders);
    }

    void loadOrders();

    return () => {
      active = false;
    };
  }, [supabaseProducts]);

  // Whitelist actions — now uses backend API for deployment
  const approveArtist = async (id: string) => {
    const entry = whitelist.find(e => e.id === id);
    if (!entry) return;

    // Optimistic update to UI
    setWhitelist(p => p.map(e => e.id === id ? { ...e, status: "approved" } : e));
    setDeployingWallet(entry.wallet);

    try {
      console.log("📋 Approving artist via backend:", entry.wallet);
      const result = await approve(entry.wallet, true, true);
      
      if (!result) {
        throw new Error(approvalError || "Approval failed");
      }

      toast.success(`✅ Artist approved${result.deployment?.address ? " & contract deployed" : ""}`);
      
      // Reload whitelist from server to get updated status
      if (result.success) {
        const updatedEntries = await getServerArtistWhitelist();
        setWhitelist(updatedEntries);
      }
      
      resolveArtistForWallet(entry.wallet);
    } catch (err: unknown) {
      console.error("❌ Approval failed:", err);
      // Roll back optimistic update
      setWhitelist(p => p.map(e => e.id === id ? { ...e, status: entry.status } : e));
      toast.error(`Approval failed: ${getErrorMessage(err)}`);
    } finally {
      setDeployingWallet(null);
    }
  };

  const rejectArtist = async (id: string) => {
    const entry = whitelist.find(e => e.id === id);
    if (!entry) return;

    setWhitelist(p => p.map(e => e.id === id ? { ...e, status: "rejected" } : e));

    try {
      await dbUpdateWhitelistEntry(id, {
        status: "rejected",
        approved_at: null,
      });
    } catch (error) {
      console.error("❌ Failed to reject artist via admin API:", error);
      setWhitelist(p => p.map(e => e.id === id ? { ...e, status: entry.status } : e));
      toast.error(error instanceof Error ? error.message : "Failed to reject artist");
      return;
    }

    toast.error("Artist rejected");
  };

  const removeArtist = async (id: string) => {
    const entry = whitelist.find(e => e.id === id);
    if (!entry) return;

    setWhitelist(p => p.filter(e => e.id !== id));

    try {
      await dbDeleteWhitelistEntry(id);
    } catch (error) {
      console.error("❌ Failed to remove artist via admin API:", error);
      setWhitelist(p => [...p, entry]);
      toast.error(error instanceof Error ? error.message : "Failed to remove artist");
      return;
    }

    toast.info("Artist removed");
  };
  const addArtist = async () => {
    // Validate wallet address
    if (!isValidWalletAddress(newWallet)) {
      toast.error("Invalid wallet address format");
      return;
    }

    // Validate name
    if (!newName.trim()) {
      toast.error("Artist name is required");
      return;
    }

    const sanitizedName = sanitizeString(newName.trim());
    if (sanitizedName.length < 2) {
      toast.error("Artist name must be at least 2 characters");
      return;
    }

    // Check for duplicate wallet
    if (whitelist.some(entry => entry.wallet.toLowerCase() === newWallet.toLowerCase())) {
      toast.error("Wallet address already exists in whitelist");
      return;
    }

    const normalizedWallet = newWallet.trim().toLowerCase();
    const now = new Date().toISOString();

    let inserted;
    try {
      inserted = await dbAddToWhitelist({
        wallet: normalizedWallet,
        name: sanitizedName,
        tag: newTag || "Other",
        status: "pending",  // Start as pending for review
        joined_at: now,
        // approved_at: null,  // Remove this - will be set when approved
        updated_at: now,
      });
    } catch (error) {
      console.error("❌ Failed to save artist via admin API:", error);
      toast.error(error instanceof Error ? error.message : "Failed to whitelist artist");
      return;
    }

    const newEntry: WhitelistEntry = {
      id: inserted?.id ?? `w${Date.now()}`,
      wallet: normalizedWallet,
      name: sanitizedName,
      tag: newTag || "Other",
      status: "pending",  // Start as pending
      joinedAt: new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
      joined_at: now,
      // approved_at: undefined,  // Not approved yet
    };

    setWhitelist(p => [...p, newEntry]);
    resolveArtistForWallet(normalizedWallet);
    setNewWallet("");
    setNewName("");
    setAddingArtist(false);
    toast.success("Artist whitelisted and approved");
  };
  const syncWhitelistAccess = () => {
    const synced = syncArtistWhitelist(whitelist);
    setWhitelist(synced);
    toast.success("Artist whitelist refreshed in runtime cache");
  };

  // Product actions
  const togglePublish = (id: string) => {
    const updated = [...products].map(prod => {
      if (prod.id === id) {
        const newStatus = prod.status === "active" ? "draft" : (prod.stock > 0 ? "active" : "out_of_stock") as "active" | "draft" | "out_of_stock";
        const updatedProduct = { ...prod, status: newStatus };
        dbUpdateProduct(id, { status: newStatus === "active" ? "published" : newStatus }).catch(err =>
          console.warn("Failed to update product status in Supabase:", err)
        );
        return updatedProduct;
      }
      return prod;
    }) as MarketProduct[];
    setProducts(updated);
  };
  const removeProduct = (id: string) => {
    setProducts(p => p.filter(prod => prod.id !== id));
    // Optionally delete from Supabase too
    toast.info("Product removed");
  };
  const saveProduct = (updated: MarketProduct) => {
    setProducts(p => p.map(prod => prod.id === updated.id ? updated : prod));
    void saveProductToDBs(updated);
  };

  // Order actions
  const updateOrder = async (id: string, status: Order["status"], trackingCode: string) => {
    setOrders(p => p.map(o => o.id === id ? { ...o, status, trackingCode } : o));
    try {
      await dbUpdateOrder(id, {
        status,
        tracking_code: trackingCode,
      });
    } catch (error) {
      console.error("Failed to update order in Supabase:", error);
      toast.error("Order update failed");
    }
  };

  // Counts for badges
  const pendingWhitelist = whitelist.filter(e => e.status === "pending").length;
  const pendingOrders = orders.filter(o => o.status === "pending").length;
  const approvedArtists = whitelist.filter(e => e.status === "approved").length;
  const filteredWhitelist = whitelist.filter(e => whitelistFilter === "all" || e.status === whitelistFilter);
  const analytics = useMemo(() => {
    const snapshot = getAnalyticsSnapshot();
    const visitSeries = getRecentVisitSeries(14);
    const currentWindow = visitSeries.slice(-7).reduce((sum, day) => sum + day.visits, 0);
    const previousWindow = visitSeries.slice(0, 7).reduce((sum, day) => sum + day.visits, 0);
    const visitorGrowth = previousWindow === 0
      ? (currentWindow > 0 ? 100 : 0)
      : ((currentWindow - previousWindow) / previousWindow) * 100;

    const artists = getAllArtists();
    const drops = getAllDrops();
    const artistById = new Map(artists.map((artist) => [artist.id, artist]));
    const dropRevenue = new Map<string, number>();

    drops.forEach((drop) => {
      const gross =
        drop.type === "Drop"
          ? Number(drop.priceEth || 0) * Number(drop.bought ?? 0)
          : Number(drop.currentBidEth ?? drop.priceEth ?? 0);
      dropRevenue.set(drop.artistId, (dropRevenue.get(drop.artistId) ?? 0) + gross);
    });

    const topArtistEntry = Array.from(dropRevenue.entries()).sort((a, b) => b[1] - a[1])[0];
    const topArtist = topArtistEntry
      ? { artist: artistById.get(topArtistEntry[0]) ?? null, grossEth: topArtistEntry[1] }
      : null;

    const topProduct = [...products]
      .map((product) => ({ ...product, grossEth: Number(product.priceEth || 0) * product.sold }))
      .sort((a, b) => b.grossEth - a.grossEth)[0] ?? null;

    const topViewedDropEntry = Object.entries(snapshot.dropViews).sort((a, b) => b[1] - a[1])[0];
    const topViewedArt = topViewedDropEntry
      ? { drop: (supabaseDrops as DropSummary[]).find((drop) => drop.id === topViewedDropEntry[0]) ?? null, views: topViewedDropEntry[1] }
      : null;

    return {
      visitSeries,
      currentWindow,
      visitorGrowth,
      topArtist,
      topProduct,
      topViewedArt,
    };
  }, [products, supabaseDrops]);

  useEffect(() => {
    // Only sync cache when data is loaded from server, not on optimistic updates
    if (whitelist.length > 0 && !whitelist.some(entry => entry.status === 'updating')) {
      syncArtistWhitelist(whitelist);
    }
  }, [whitelist]);

  return (
    <div className="min-h-screen bg-background">
      {/* Admin top bar — separate from the public TopBar */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between h-14 px-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-tight">PopUp Admin</p>
              <p className="text-[10px] text-muted-foreground font-mono leading-tight truncate max-w-[140px]">{address}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-full gap-1.5" onClick={() => { disconnect(); toast.info("Disconnected from admin"); }}>
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
        </div>
      </header>

      {/* Summary cards */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-2 grid grid-cols-4 gap-2">
        {[
          { label: "Whitelisted", value: approvedArtists, icon: Users },
          { label: "Products", value: products.filter(p => p.status === "active").length, icon: ShoppingBag },
          { label: "Orders", value: orders.length, icon: Package },
          { label: "Pending", value: pendingWhitelist + pendingOrders, icon: AlertTriangle },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-2xl bg-card border border-border text-center">
            <s.icon className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="max-w-2xl mx-auto px-4 pb-12">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full bg-secondary rounded-xl h-10 grid grid-cols-4 mb-4">
            <TabsTrigger value="whitelist" className="rounded-lg text-xs">
              Artists
              {pendingWhitelist > 0 && (
                <span className="ml-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] inline-flex items-center justify-center">{pendingWhitelist}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="products" className="rounded-lg text-xs">Products</TabsTrigger>
            <TabsTrigger value="orders" className="rounded-lg text-xs">
              Orders
              {pendingOrders > 0 && (
                <span className="ml-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] inline-flex items-center justify-center">{pendingOrders}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-lg text-xs">Analytics</TabsTrigger>
          </TabsList>

          {/* ── Artists / Whitelist ── */}
          <TabsContent value="whitelist" className="space-y-3">
            {/* Filter pills */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {(["all", "pending", "approved", "rejected"] as const).map(f => (
                <button key={f} onClick={() => setWhitelistFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs whitespace-nowrap capitalize transition-colors ${whitelistFilter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  {f} {f !== "all" && `(${whitelist.filter(e => e.status === f).length})`}
                </button>
              ))}
            </div>

            <Button size="sm" variant="outline" className="w-full rounded-xl" onClick={syncWhitelistAccess}>
              <Upload className="h-4 w-4 mr-2" /> Sync Artist Access
            </Button>

            {/* Add new artist */}
            {addingArtist ? (
              <div className="p-4 rounded-2xl bg-card border border-primary/40 space-y-3">
                <p className="text-sm font-semibold text-foreground">Whitelist new artist</p>
                <div>
                  <Label className="text-xs">Wallet address</Label>
                  <Input placeholder="0x..." value={newWallet} onChange={e => setNewWallet(e.target.value)} className="h-9 rounded-lg text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Artist name</Label>
                    <Input placeholder="Display name" value={newName} onChange={e => setNewName(e.target.value)} className="h-9 rounded-lg text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Art type</Label>
                    <select value={newTag} onChange={e => setNewTag(e.target.value)}
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm">
                      {["Digital Art", "Sculpture", "Photography", "Mixed Media", "Generative", "Other"].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 rounded-xl" onClick={() => setAddingArtist(false)}>Cancel</Button>
                  <Button size="sm" className="flex-1 rounded-xl gradient-primary text-primary-foreground" onClick={addArtist}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Whitelist & Approve
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" className="w-full rounded-xl gradient-primary text-primary-foreground font-semibold" onClick={() => setAddingArtist(true)}>
                <Plus className="h-4 w-4 mr-2" /> Whitelist New Artist
              </Button>
            )}

            {filteredWhitelist.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">No artists in this category.</p>
            )}

            {filteredWhitelist.map(entry => (
              <div key={entry.id} className="p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{entry.name}</p>
                      <Badge variant="outline" className="text-[10px]">{entry.tag}</Badge>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${whitelistColor[entry.status]}`}>
                        {entry.status}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground mt-1 truncate">{entry.wallet}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Added {entry.joinedAt}</p>
                    {(entry as WhitelistEntryWithContract).contract_address && (
                      <div className="mt-2 p-2 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                        <p className="text-[9px] font-semibold text-green-700 dark:text-green-300 mb-1">Contract Deployed</p>
                        <p className="text-[9px] font-mono text-green-600 dark:text-green-400 break-all">{(entry as WhitelistEntryWithContract).contract_address}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {entry.status === "pending" && (
                      <>
                        <button 
                          onClick={() => approveArtist(entry.id)}
                          disabled={isApproving && deployingWallet === entry.wallet}
                          className="p-2 rounded-xl bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-waiting" 
                          title="Approve">
                          {isApproving && deployingWallet === entry.wallet ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                        </button>
                        <button onClick={() => rejectArtist(entry.id)}
                          className="p-2 rounded-xl bg-red-100 text-red-700 hover:bg-red-200 transition-colors" title="Reject">
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {entry.status === "approved" && (
                      <button onClick={() => rejectArtist(entry.id)}
                        className="p-2 rounded-xl bg-secondary text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors" title="Revoke">
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                    {entry.status === "rejected" && (
                      <button onClick={() => approveArtist(entry.id)}
                        className="p-2 rounded-xl bg-secondary text-muted-foreground hover:bg-green-50 hover:text-green-700 transition-colors" title="Re-approve">
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => removeArtist(entry.id)}
                      className="p-2 rounded-xl bg-secondary text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* ── Products ── */}
          <TabsContent value="products" className="space-y-3">
            <AddProductDialog onAdd={async (p, wallet) => { 
              try {
                setProducts(prev => [...prev, p]);
                await saveProductToDBs(p, wallet || "0x0");
                toast.success("✅ Product saved to database");
              } catch (err: unknown) {
                console.error("Failed to save product to database:", err);
                toast.error(`Database save failed: ${getErrorMessage(err)}`);
                // Remove from local state if Supabase save failed
                setProducts(prev => prev.filter(prod => prod.id !== p.id));
                throw err; // Re-throw so dialog knows to keep trying
              }
            }} adminAddress={address || "0x0"} />

            {productsLoading && (
              <p className="text-center text-xs text-muted-foreground py-8 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading products from Supabase...
              </p>
            )}

            {!productsLoading && products.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">No products yet. Add one above.</p>
            )}

            {products.map(p => (
              <div key={p.id} className="p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-start justify-between gap-3 mb-3">
                  {p.image && (
                    <div className="h-14 w-14 rounded-xl overflow-hidden shrink-0">
                      <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{p.name}</p>
                      <Badge variant="secondary" className="text-[10px]">{p.category}</Badge>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${productColor[p.status]}`}>
                        {p.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { label: "ETH", value: `${p.priceEth}` },
                    { label: "Added", value: p.uploadedAt },
                    { label: "Stock", value: String(p.stock) },
                    { label: "Sold", value: String(p.sold) },
                  ].map(s => (
                    <div key={s.label} className="text-center p-2 rounded-lg bg-secondary">
                      <p className="text-xs font-bold text-foreground">{s.value}</p>
                      <p className="text-[9px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                {p.stock === 0 && p.status !== "out_of_stock" && (
                  <div className="flex items-center gap-1 text-[10px] text-destructive mb-2">
                    <AlertTriangle className="h-3 w-3" /> Out of stock — hide or restock
                  </div>
                )}
                {p.stock > 0 && p.stock <= 3 && (
                  <div className="flex items-center gap-1 text-[10px] text-yellow-700 mb-2">
                    <AlertTriangle className="h-3 w-3" /> Low stock
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex gap-3">
                    <EditProductDialog product={p} onSave={saveProduct} />
                    <a href={p.nftLink} target="_blank" rel="noreferrer" className="text-[10px] text-primary flex items-center gap-0.5">
                      <Upload className="h-3 w-3" /> NFT
                    </a>
                    <button onClick={() => removeProduct(p.id)} className="text-[10px] text-destructive flex items-center gap-0.5">
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                  <button onClick={() => togglePublish(p.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${p.status === "active" ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}>
                    {p.status === "active" ? <><Eye className="h-3 w-3" /> Live</> : <><EyeOff className="h-3 w-3" /> Draft</>}
                  </button>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* ── Orders ── */}
          <TabsContent value="orders" className="space-y-3">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {(["all", "pending", "shipped", "delivered", "cancelled"] as const).map(f => (
                <button key={f}
                  className="px-3 py-1 rounded-full text-xs whitespace-nowrap capitalize bg-secondary text-muted-foreground"
                  onClick={() => toast.info(`Filtering by ${f} — coming soon`)}>
                  {f}
                </button>
              ))}
            </div>

            {orders.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">No orders yet.</p>
            )}

            {orders.map(order => (
              <div key={order.id} className="p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold font-mono text-foreground">{order.id}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{order.product} · Qty {order.qty}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{order.buyer}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full capitalize ${orderColor[order.status]}`}>
                    {order.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                  <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" /> {order.address}</div>
                  <div className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 shrink-0" />
                    Tracking: <span className="font-mono font-semibold text-foreground ml-1">{order.trackingCode}</span>
                  </div>
                  <div className="text-[10px]">Ordered {order.date}</div>
                </div>

                <div className="flex justify-end">
                  <UpdateOrderDialog order={order} onUpdate={updateOrder} />
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Visitor Growth</p>
                </div>
                <p className="text-2xl font-bold text-foreground">{analytics.currentWindow}</p>
                <p className={`text-xs mt-1 ${analytics.visitorGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {analytics.visitorGrowth >= 0 ? "+" : ""}{analytics.visitorGrowth.toFixed(1)}% vs previous 7 days
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Most Viewed Art</p>
                </div>
                <p className="text-sm font-bold text-foreground">
                  {analytics.topViewedArt?.drop?.title ?? "No views yet"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.topViewedArt ? `${analytics.topViewedArt.views} views` : "Public views will appear here"}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Top Grossing Artist</p>
                </div>
                <p className="text-sm font-bold text-foreground">
                  {analytics.topArtist?.artist?.name ?? "No sales yet"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.topArtist ? `${analytics.topArtist.grossEth.toFixed(3)} ETH gross` : "Drop revenue will appear here"}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Top Product</p>
                </div>
                <p className="text-sm font-bold text-foreground">
                  {analytics.topProduct?.name ?? "No product sales yet"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.topProduct ? `${analytics.topProduct.grossEth.toFixed(3)} ETH gross` : "Marketplace sales will appear here"}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Traffic Trend</p>
              </div>
              {analytics.visitSeries.every((point) => point.visits === 0) ? (
                <p className="text-xs text-muted-foreground">No public traffic yet. Views start tracking when visitors browse artists, drops, and marketplace products.</p>
              ) : (
                <>
                  <div className="flex items-end gap-2 h-28">
                    {analytics.visitSeries.map((point) => {
                      const maxVisits = Math.max(...analytics.visitSeries.map((entry) => entry.visits), 1);
                      const height = Math.max((point.visits / maxVisits) * 100, point.visits > 0 ? 12 : 4);
                      return (
                        <div key={point.date} className="flex-1 rounded-t-lg bg-primary/20 relative" style={{ height: `${height}%` }}>
                          <div className="absolute inset-x-0 bottom-0 rounded-t-lg bg-primary" style={{ height: `${height}%` }} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2">
                    {analytics.visitSeries.map((point) => (
                      <span key={point.date} className="text-[9px] text-muted-foreground">
                        {new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPage;
