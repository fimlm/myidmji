import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"

export function PrivacyPolicyModal({ children }: { children: React.ReactNode }) {
    const [content, setContent] = useState<string>("")

    useEffect(() => {
        fetch("/legal/policy.md")
            .then((res) => res.text())
            .then((text) => setContent(text))
            .catch((err) => console.error("Failed to load privacy policy", err))
    }, [])

    return (
        <Dialog>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Privacy Policy</DialogTitle>
                    <DialogDescription>
                        Please read our privacy policy carefully.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-4 border rounded-md prose dark:prose-invert max-w-none">
                    <ReactMarkdown>{content}</ReactMarkdown>
                </div>
            </DialogContent>
        </Dialog>
    )
}
