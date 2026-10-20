import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SecretInput(props: ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  return <div className="secret-input"><Input {...props} type={visible ? "text" : "password"} autoComplete="off" spellCheck={false} /><Button type="button" variant="ghost" size="icon-sm" aria-label={visible ? "隐藏地址或密钥" : "显示地址或密钥"} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff /> : <Eye />}</Button></div>;
}
