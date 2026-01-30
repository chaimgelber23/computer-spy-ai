import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Activity, Monitor, BrainCircuit, Zap, Download, Mail } from "lucide-react"

export default function Home() {
    return (
        <div className="flex flex-col min-h-screen">
            <header className="px-6 lg:px-10 h-16 flex items-center border-b">
                <Link href="/" className="flex items-center justify-center gap-2">
                    <Activity className="h-6 w-6 text-primary" />
                    <span className="font-bold text-xl">Workflow Spy</span>
                </Link>
                <nav className="ml-auto flex gap-4 sm:gap-6">
                    <Link href="/login">
                        <Button variant="ghost" size="sm">
                            Admin Sign In
                        </Button>
                    </Link>
                </nav>
            </header>
            <main className="flex-1">
                <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 flex flex-col items-center text-center px-4">
                    <div className="container px-4 md:px-6">
                        <div className="flex flex-col items-center space-y-4 text-center">
                            <div className="space-y-2">
                                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                                    Discover What You Can Automate
                                </h1>
                                <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                                    Download our lightweight desktop agent, enter your email, and we&apos;ll
                                    analyze your workflow to find automation opportunities that save you hours every week.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                <a href="https://github.com/chaimgelber23/computer-spy-ai/releases/download/v1.0.0/Workflow.Spy.Setup.1.0.0.exe">
                                    <Button size="lg" className="h-12 px-8">
                                        <Download className="mr-2 h-4 w-4" />
                                        Download for Windows
                                    </Button>
                                </a>
                                <Button size="lg" variant="outline" className="h-12 px-8" disabled>
                                    <Download className="mr-2 h-4 w-4" />
                                    Mac (Coming Soon)
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-50 dark:bg-gray-900 flex justify-center">
                    <div className="container px-4 md:px-6">
                        <h2 className="text-3xl font-bold tracking-tighter text-center mb-12">How It Works</h2>
                        <div className="grid gap-10 sm:grid-cols-3">
                            <div className="flex flex-col items-center space-y-4 text-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                                    <Monitor className="h-7 w-7 text-blue-600 dark:text-blue-300" />
                                </div>
                                <h3 className="text-xl font-bold">1. Download & Install</h3>
                                <p className="text-gray-500 dark:text-gray-400">
                                    Download the desktop agent for Windows or Mac. Installation takes less than a minute.
                                </p>
                            </div>
                            <div className="flex flex-col items-center space-y-4 text-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                                    <Mail className="h-7 w-7 text-green-600 dark:text-green-300" />
                                </div>
                                <h3 className="text-xl font-bold">2. Enter Your Email</h3>
                                <p className="text-gray-500 dark:text-gray-400">
                                    Open the app, enter your email address, and we start monitoring your workflow patterns in the background.
                                </p>
                            </div>
                            <div className="flex flex-col items-center space-y-4 text-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
                                    <BrainCircuit className="h-7 w-7 text-purple-600 dark:text-purple-300" />
                                </div>
                                <h3 className="text-xl font-bold">3. Get Your Report</h3>
                                <p className="text-gray-500 dark:text-gray-400">
                                    We&apos;ll email you personalized automation recommendations based on your actual work patterns at 3, 7, 14, and 21 days.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="w-full py-12 md:py-24 lg:py-32 flex justify-center">
                    <div className="container px-4 md:px-6">
                        <div className="flex flex-col items-center space-y-4 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
                                <Zap className="h-7 w-7 text-yellow-600 dark:text-yellow-300" />
                            </div>
                            <h2 className="text-3xl font-bold tracking-tighter">Ready to Save Time?</h2>
                            <p className="mx-auto max-w-[600px] text-gray-500 dark:text-gray-400">
                                Download, enter your email, and we&apos;ll do the rest. You&apos;ll receive
                                personalized automation recommendations delivered straight to your inbox.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 mt-4">
                                <a href="https://github.com/chaimgelber23/computer-spy-ai/releases/download/v1.0.0/Workflow.Spy.Setup.1.0.0.exe">
                                    <Button size="lg">
                                        <Download className="mr-2 h-4 w-4" />
                                        Download for Windows
                                    </Button>
                                </a>
                                <Button size="lg" variant="outline" disabled>
                                    <Download className="mr-2 h-4 w-4" />
                                    Mac (Coming Soon)
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
                <p className="text-xs text-gray-500 dark:text-gray-400">© 2026 Workflow Spy. All rights reserved.</p>
                <nav className="sm:ml-auto flex gap-4 sm:gap-6">
                    <Link className="text-xs hover:underline underline-offset-4" href="#">
                        Terms of Service
                    </Link>
                    <Link className="text-xs hover:underline underline-offset-4" href="#">
                        Privacy
                    </Link>
                </nav>
            </footer>
        </div>
    )
}
