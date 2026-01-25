import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Activity, Monitor, BrainCircuit, Zap } from "lucide-react"

export default function Home() {
    return (
        <div className="flex flex-col min-h-screen">
            <header className="px-6 lg:px-10 h-16 flex items-center border-b">
                <Link href="/" className="flex items-center justify-center gap-2">
                    <Activity className="h-6 w-6 text-primary" />
                    <span className="font-bold text-xl">Computer Spy AI</span>
                </Link>
                <nav className="ml-auto flex gap-4 sm:gap-6">
                    <Link href="/login">
                        <Button variant="ghost" size="sm">
                            Sign In
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
                                    Unlock Your Workflow Potential
                                </h1>
                                <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                                    AI-powered activity tracking that analyzes your work patterns and suggests automations to save you hours every week.
                                </p>
                            </div>
                            <div className="space-x-4 pt-4">
                                <Link href="/login">
                                    <Button size="lg" className="h-12 px-8">
                                        Get Started <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
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
                                <h3 className="text-xl font-bold">1. Install the Agent</h3>
                                <p className="text-gray-500 dark:text-gray-400">
                                    Download and run the lightweight desktop agent. Sign in with your account credentials.
                                </p>
                            </div>
                            <div className="flex flex-col items-center space-y-4 text-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                                    <Activity className="h-7 w-7 text-green-600 dark:text-green-300" />
                                </div>
                                <h3 className="text-xl font-bold">2. Work Normally</h3>
                                <p className="text-gray-500 dark:text-gray-400">
                                    The agent quietly tracks which apps you use and how long you spend on each task.
                                </p>
                            </div>
                            <div className="flex flex-col items-center space-y-4 text-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
                                    <BrainCircuit className="h-7 w-7 text-purple-600 dark:text-purple-300" />
                                </div>
                                <h3 className="text-xl font-bold">3. Get AI Insights</h3>
                                <p className="text-gray-500 dark:text-gray-400">
                                    Our AI analyzes your patterns and suggests specific automations and workflows to boost productivity.
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
                                Join and discover which tasks you can automate to reclaim hours of your workweek.
                            </p>
                            <Link href="/login">
                                <Button size="lg" className="mt-4">
                                    Sign In to Your Account
                                </Button>
                            </Link>
                        </div>
                    </div>
                </section>
            </main>
            <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
                <p className="text-xs text-gray-500 dark:text-gray-400">© 2026 Computer Spy AI. All rights reserved.</p>
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
