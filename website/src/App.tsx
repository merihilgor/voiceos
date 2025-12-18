import React from 'react';
import Hero from './components/Hero';
import Features from './components/Features';
import Roadmap from './components/Roadmap';
import Footer from './components/Footer';

function App() {
    return (
        <div className="min-h-screen bg-gray-950 text-white selection:bg-blue-500/30">
            <nav className="absolute top-0 w-full z-50 p-6 flex justify-between items-center max-w-7xl mx-auto left-0 right-0">
                <div className="text-xl font-bold tracking-tighter">VoiceOS</div>
                <div className="flex gap-6 text-sm text-gray-400">
                    <a href="#features" className="hover:text-white transition-colors">Features</a>
                    <a href="#roadmap" className="hover:text-white transition-colors">Roadmap</a>
                    <a href="https://github.com/merihilgor/voiceos" className="hover:text-white transition-colors">GitHub</a>
                </div>
            </nav>
            <main>
                <Hero />
                <Features />
                <Roadmap />
            </main>
            <Footer />
        </div>
    );
}

export default App;
