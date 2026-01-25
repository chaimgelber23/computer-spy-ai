"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Settings, Activity, BrainCircuit, LogOut, Shield } from "lucide-react"
import { useAuth, useUser, useFirestore } from '@/firebase/provider';

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarFooter,
    SidebarSeparator,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

// Menu items.
const items = [
    {
        title: "Activity Logs",
        url: "/dashboard/activity",
        icon: Activity,
    },
    {
        title: "AI Insights",
        url: "/dashboard/insights",
        icon: BrainCircuit,
    },
    {
        title: "Settings",
        url: "/dashboard/settings",
        icon: Settings
    }
]

export function AppSidebar() {
    const auth = useAuth();
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);

    // Check if user is admin
    useEffect(() => {
        if (!user?.uid || !firestore) return;

        const checkAdmin = async () => {
            try {
                const userDoc = await getDoc(doc(firestore, 'users', user.uid));
                const data = userDoc.data();
                setIsAdmin(data?.role === 'admin');
            } catch (e) {
                // Not an admin
            }
        };

        checkAdmin();
    }, [user?.uid, firestore]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push('/login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const getInitials = () => {
        if (user?.displayName) {
            return user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        }
        if (user?.email) {
            return user.email[0].toUpperCase();
        }
        return 'U';
    };

    return (
        <Sidebar>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Computer Spy AI</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild>
                                        <a href={item.url}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Admin Section */}
                {isAdmin && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Administration</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild>
                                        <a href="/dashboard/admin">
                                            <Shield />
                                            <span>Admin Panel</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>

            <SidebarFooter>
                <SidebarSeparator />
                <div className="p-2">
                    {/* User info */}
                    <div className="flex items-center gap-3 px-2 py-2 rounded-md bg-muted/50 mb-2">
                        <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                                {getInitials()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                                {user?.displayName || 'User'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                {user?.email}
                            </p>
                        </div>
                    </div>

                    {/* Logout button */}
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
                                <LogOut className="h-4 w-4" />
                                <span>Sign Out</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </div>
            </SidebarFooter>
        </Sidebar>
    )
}
