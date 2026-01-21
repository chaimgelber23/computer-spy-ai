"use client"

import { useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

export function FirebaseErrorListener() {
    const { toast } = useToast()

    useEffect(() => {
        const handlePermissionError = (error: FirestorePermissionError) => {
            console.error("Firebase Permission Error:", error)
            toast({
                variant: "destructive",
                title: "Access Denied",
                description: "You do not have permission to view this data.",
            })
        }

        // Subscribe
        errorEmitter.on('permission-error', handlePermissionError)

        // Unsubscribe
        return () => {
            errorEmitter.off('permission-error', handlePermissionError)
        }
    }, [toast])

    return null
}
