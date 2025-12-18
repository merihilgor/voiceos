import React from 'react';
import { Mic, ArrowRight, Command } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Hero() {
    return (
        <div className="relative overflow-hidden pt-32 pb-20 lg:pt-48 lg:pb-32">
            <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
                        <span className="block">Control macOS</span>
                        <span className="block text-blue-500 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                            With Just Your Voice
                        </span>
                    </h1>
                    <p className="mt-6 mx-auto max-w-2xl text-lg text-gray-300">
                        Juvenile (VoiceOS) captures your intent and executes complex system commands using Google Gemini. Hands-free, robust, and open source.
                    </p>

                    <div className="mt-10 flex justify-center gap-4">
                        <a
                            href="https://github.com/merihilgor/voiceos"
                            className="group flex items-center justify-center rounded-full bg-blue-600 px-8 py-3 text-base font-semibold text-white transition-all hover:bg-blue-500 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-900"
                        >
                            Get Started <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1" />
                        </a>
                        <a
                            href="#demo"
                            className="flex items-center justify-center rounded-full border border-gray-700 bg-gray-800/50 px-8 py-3 text-base font-semibold text-gray-300 backdrop-blur-sm transition-all hover:bg-gray-800 hover:text-white"
                        >
                            Watch Demo
                        </a>
                    </div>
                </motion.div>

                {/* Abstract UI Representation */}
                <motion.div
                    className="mt-20 relative mx-auto max-w-4xl rounded-2xl border border-gray-800 bg-gray-950/50 shadow-2xl backdrop-blur-xl p-4"
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                >
                    <div className="aspect-[16/9] w-full rounded-lg bg-gradient-to-br from-gray-900 to-black relative overflow-hidden flex items-center justify-center">
                        {/* Fake Interface */}
                        <div className="absolute top-4 left-4 flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                        </div>

                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-500/10 mb-6 animate-pulse">
                                <Mic className="w-10 h-10 text-blue-400" />
                            </div>
                            <h3 className="text-2xl font-medium text-white mb-2">"Open Safari and search for Tailwind CSS"</h3>
                            <div className="flex items-center justify-center gap-2 text-sm text-green-400 mt-4">
                                <Command className="w-4 h-4" />
                                <span>Executing Action...</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
