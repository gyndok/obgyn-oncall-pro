import { useCallback, useRef, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmOptions { title: string; description: string; confirmLabel?: string }

/** Promise-based confirmation dialog: `if (!(await confirm({...}))) return;` */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>();

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>(resolve => {
    resolver.current = resolve;
    setOpts(o);
  }), []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = undefined;
    setOpts(null);
  };

  const dialog = (
    <AlertDialog open={!!opts} onOpenChange={o => { if (!o) close(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
          <AlertDialogDescription>{opts?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => close(true)}>{opts?.confirmLabel ?? "Continue"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}
