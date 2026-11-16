import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Loader2, Tag, ChevronRight, Pencil, Trash2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, Category, CategoryKind,
} from "@/hooks/useCategories";
import { ToggleSelect } from "@/components/ui/toggle-select";
import { useToast } from "@/hooks/use-toast";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

const CategoriesPage = () => {
  const { data: categories = [], isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState<string>("none");
  const [newKind, setNewKind] = useState<CategoryKind>("expense");
  const [editName, setEditName] = useState("");
  const [editKind, setEditKind] = useState<CategoryKind>("expense");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<CategoryKind>("expense");

  const allParents = categories.filter(c => !c.parent_id);
  const parents = allParents.filter(c => c.kind === tab || c.kind === "both");
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const parent = newParentId === "none" ? null : allParents.find(p => p.id === newParentId);
    try {
      await createCategory.mutateAsync({
        name: newName.trim(),
        parent_id: parent ? parent.id : null,
        kind: parent ? parent.kind : newKind,
      });
      setAddOpen(false);
      setNewName("");
      setNewParentId("none");
      toast({ title: newParentId === "none" ? "Category added!" : "Subcategory added!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCat || !editName.trim()) return;
    try {
      await updateCategory.mutateAsync({ id: editCat.id, name: editName.trim(), kind: editKind });
      // keep subcategories aligned with their parent's kind
      if (!editCat.parent_id && editKind !== editCat.kind) {
        await Promise.all(
          getChildren(editCat.id).map(child => updateCategory.mutateAsync({ id: child.id, kind: editKind }))
        );
      }
      setEditOpen(false);
      setEditCat(null);
      toast({ title: "Category updated!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (cat: Category) => {
    try {
      await deleteCategory.mutateAsync(cat.id);
      toast({ title: `"${cat.name}" deleted` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const openEdit = (cat: Category) => {
    setEditCat(cat);
    setEditName(cat.name);
    setEditKind(cat.kind);
    setEditOpen(true);
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground">
            {parents.length} {tab} categories · {categories.filter(c => c.parent_id && parents.some(p => p.id === c.parent_id)).length} subcategories
          </p>
        </div>
        <ResponsiveDialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (o) setNewKind(tab); }}>
          <ResponsiveDialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </ResponsiveDialogTrigger>
          <ResponsiveDialogContent className="glass-card border-glass-border">
            <ResponsiveDialogHeader><ResponsiveDialogTitle>Add Category</ResponsiveDialogTitle></ResponsiveDialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Placement</Label>
                <Select value={newParentId} onValueChange={setNewParentId}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Top-level category</SelectItem>
                    {allParents.map(p => (
                      <SelectItem key={p.id} value={p.id}>Sub of "{p.name}" ({p.kind})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {newParentId === "none" && (
                <div className="space-y-1.5">
                  <Label>Used for</Label>
                  <ToggleSelect
                    value={newKind}
                    onValueChange={(v) => setNewKind(v as CategoryKind)}
                    options={[
                      { value: "expense", label: "Expense" },
                      { value: "income", label: "Income" },
                      { value: "both", label: "Both" },
                    ]}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder={newParentId === "none" ? "e.g. Food" : "e.g. Dry goods"}
                  className="bg-secondary"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={createCategory.isPending}>
                {createCategory.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add {newParentId === "none" ? "Category" : "Subcategory"}
              </Button>
            </form>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </div>

      {/* Income / Expense tabs */}
      <ToggleSelect
        value={tab}
        onValueChange={(v) => setTab(v as CategoryKind)}
        options={[
          { value: "expense", label: "Expense categories" },
          { value: "income", label: "Income categories" },
        ]}
      />

      {/* Edit dialog */}
      <ResponsiveDialog open={editOpen} onOpenChange={setEditOpen}>
        <ResponsiveDialogContent className="glass-card border-glass-border">
          <ResponsiveDialogHeader><ResponsiveDialogTitle>Edit Category</ResponsiveDialogTitle></ResponsiveDialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="bg-secondary"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Used for</Label>
              <ToggleSelect
                value={editKind}
                onValueChange={(v) => setEditKind(v as CategoryKind)}
                options={[
                  { value: "expense", label: "Expense" },
                  { value: "income", label: "Income" },
                  { value: "both", label: "Both" },
                ]}
              />
            </div>
            <Button type="submit" className="w-full" disabled={updateCategory.isPending}>
              {updateCategory.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {parents.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground">
          <Tag className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No {tab} categories yet. Add one with the button above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {parents.map((parent, i) => {
            const children = getChildren(parent.id);
            const isExpanded = expandedIds.has(parent.id);

            return (
              <motion.div
                key={parent.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass-card overflow-hidden"
              >
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(parent.id)}>
                  <div className="flex items-center gap-3 p-4">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FolderOpen className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{parent.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {children.length} subcategories
                          </p>
                        </div>
                        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                      </button>
                    </CollapsibleTrigger>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" aria-label="Edit category" className="h-8 w-8" onClick={() => openEdit(parent)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Delete category" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete "{parent.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will also delete all {children.length} subcategories. Existing transactions won't be affected.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(parent)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  <CollapsibleContent>
                    <AnimatePresence>
                      {children.length > 0 && (
                        <div className="border-t border-border">
                          {children.map((child, j) => (
                            <motion.div
                              key={child.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: j * 0.02 }}
                              className="flex items-center gap-3 pl-10 pr-4 py-3 hover:bg-secondary/30 transition-colors"
                            >
                              <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-sm flex-1 min-w-0 truncate">{child.name}</span>
                              <div className="flex gap-1 shrink-0">
                                <Button variant="ghost" size="icon" aria-label="Edit subcategory" className="h-7 w-7" onClick={() => openEdit(child)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" aria-label="Delete subcategory" className="h-7 w-7 text-destructive hover:text-destructive">
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete "{child.name}"?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Existing transactions won't be affected.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(child)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </AnimatePresence>

                    <QuickAddSub parentId={parent.id} parentName={parent.name} />
                  </CollapsibleContent>
                </Collapsible>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

function QuickAddSub({ parentId, parentName }: { parentId: string; parentName: string }) {
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const createCategory = useCreateCategory();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createCategory.mutateAsync({ name: name.trim(), parent_id: parentId });
      setName("");
      setShow(false);
      toast({ title: `Added to ${parentName}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="flex items-center gap-2 pl-10 pr-4 py-2.5 w-full text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors border-t border-border"
      >
        <Plus className="h-3 w-3" /> Add subcategory
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 pl-10 pr-4 py-2 border-t border-border">
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Subcategory name"
        className="h-8 text-sm bg-secondary"
        autoFocus
      />
      <Button type="submit" size="sm" className="h-8 text-xs" disabled={createCategory.isPending}>
        Add
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShow(false)}>
        Cancel
      </Button>
    </form>
  );
}

export default CategoriesPage;
