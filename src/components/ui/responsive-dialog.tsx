import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose, DrawerDescription,
} from "@/components/ui/drawer";

interface ResponsiveDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function ResponsiveDialog({ open, onOpenChange, children }: ResponsiveDialogProps) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <Drawer open={open} onOpenChange={onOpenChange}>{children}</Drawer>;
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>{children}</Dialog>;
}

function ResponsiveDialogTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const isMobile = useIsMobile();
  if (isMobile) return <DrawerTrigger asChild={asChild}>{children}</DrawerTrigger>;
  return <DialogTrigger asChild={asChild}>{children}</DialogTrigger>;
}

function ResponsiveDialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <DrawerContent className={className}>
        <div className="max-h-[85vh] overflow-y-auto px-4 pb-8">
          {children}
        </div>
      </DrawerContent>
    );
  }
  return (
    <DialogContent className={`max-h-[90vh] overflow-y-auto ${className || ""}`}>
      {children}
    </DialogContent>
  );
}

function ResponsiveDialogHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  const isMobile = useIsMobile();
  if (isMobile) return <DrawerHeader className={className}>{children}</DrawerHeader>;
  return <DialogHeader className={className}>{children}</DialogHeader>;
}

function ResponsiveDialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  const isMobile = useIsMobile();
  if (isMobile) return <DrawerTitle className={className}>{children}</DrawerTitle>;
  return <DialogTitle className={className}>{children}</DialogTitle>;
}

function ResponsiveDialogDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  const isMobile = useIsMobile();
  if (isMobile) return <DrawerDescription className={className}>{children}</DrawerDescription>;
  return <DialogDescription className={className}>{children}</DialogDescription>;
}

function ResponsiveDialogClose({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const isMobile = useIsMobile();
  if (isMobile) return <DrawerClose asChild={asChild}>{children}</DrawerClose>;
  return <DialogClose asChild={asChild}>{children}</DialogClose>;
}

export {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogClose,
};
