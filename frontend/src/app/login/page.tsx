'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ArrowRight, Shield, Package, Sparkles, Zap, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const toastTimeoutRef = useRef<number | null>(null);
  
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const triggerToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setShowToast(true);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setShowToast(false);
    }, 12000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(email, password);
      triggerToast('✅ Sign-in successful!\nRedirecting to your dashboard...', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      triggerToast('❌ Invalid email or password!\nPlease check your credentials and try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-orange-50 via-white to-amber-50">
      {/* Animated Mesh Gradient Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(251,146,60,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(251,146,60,0.03)_1px,transparent_1px)] bg-[size:64px_64px]"></div>
        
        {/* Dynamic Gradient Orbs - Lighter */}
        <div 
          className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-3xl animate-float"
          style={{
            background: 'radial-gradient(circle, rgba(251,146,60,0.15) 0%, rgba(245,158,11,0.08) 50%, transparent 70%)',
            left: `${mousePosition.x / 25}px`,
            top: `${mousePosition.y / 25}px`,
          }}
        ></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-tl from-yellow-200/20 via-orange-200/10 to-transparent rounded-full blur-3xl animate-float-delayed"></div>
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-gradient-to-br from-amber-200/15 to-transparent rounded-full blur-3xl animate-pulse-slow"></div>
        
        {/* Floating Particles - Subtle */}
        <div className="absolute top-20 left-20 w-2 h-2 bg-orange-300/40 rounded-full animate-float-particle"></div>
        <div className="absolute top-40 right-40 w-1.5 h-1.5 bg-amber-300/40 rounded-full animate-float-particle-delayed"></div>
        <div className="absolute bottom-32 left-1/3 w-2 h-2 bg-yellow-300/40 rounded-full animate-float-particle"></div>
        <div className="absolute bottom-20 right-20 w-1 h-1 bg-orange-200/40 rounded-full animate-float-particle-delayed"></div>
      </div>

      {/* Toast Notification */}
      <div
        className={`fixed top-6 right-6 z-50 transform transition-all duration-500 ${
          showToast ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
        }`}
      >
        {toast && (
          <div className={`relative overflow-hidden rounded-2xl shadow-2xl border-2 min-w-[320px] max-w-[420px] ${
            toast.type === 'success' 
              ? 'bg-white border-green-300' 
              : 'bg-white border-red-300'
          }`}>
            <div className={`absolute top-0 left-0 h-1 w-full animate-progress ${
              toast.type === 'success' 
                ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                : 'bg-gradient-to-r from-red-500 to-rose-500'
            }`}></div>
            <div className={`relative px-5 py-4 whitespace-pre-line leading-relaxed text-[15px] font-medium ${
              toast.type === 'success' ? 'text-green-900' : 'text-red-900'
            }`}>
              {toast.message}
            </div>
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-2xl">
        {/* Main Login Card */}
        <div className="relative group animate-fade-in-up">
          {/* Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-3xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity duration-500"></div>
          
          {/* Main Card - White Background */}
          <div className="relative bg-white backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
            {/* Subtle Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-orange-50/30 via-transparent to-transparent pointer-events-none"></div>
            
            {/* Login Form Section */}
            <div className="relative p-8 lg:p-12">
              {/* Decorative Corner Elements */}
              <div className="absolute top-0 left-0 w-20 h-20 border-t-2 border-l-2 border-orange-200 rounded-tl-3xl"></div>
              <div className="absolute bottom-0 right-0 w-20 h-20 border-b-2 border-r-2 border-orange-200 rounded-br-3xl"></div>
              
              <div className="max-w-md mx-auto relative">
                {/* Header Section with Icon and Title */}
                <div className="mb-8 text-center animate-fade-in-down">
                  <div className="flex items-start justify-center gap-4 mb-6">
                    {/* 3D Floating Icon */}
                    <div className="relative group/icon flex-shrink-0">
                      <div className="absolute -inset-2 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-2xl blur-lg opacity-30 group-hover/icon:opacity-50 animate-pulse-slow"></div>
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl blur-sm"></div>
                        <div className="relative w-16 h-16 bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-400 rounded-xl flex items-center justify-center shadow-xl transform group-hover/icon:scale-110 group-hover/icon:rotate-12 transition-all duration-500">
                          <Package className="w-8 h-8 text-white drop-shadow-lg" />
                          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-ping-slow"></div>
                          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Title & Tagline */}
                    <div className="flex-1 min-w-0 text-left">
                      <h1 className="text-2xl sm:text-3xl font-black mb-2 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 bg-clip-text text-transparent animate-gradient-x leading-tight">
                        Inventory Order Management System
                      </h1>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Sparkles className="w-4 h-4 text-orange-500 animate-pulse flex-shrink-0" />
                        <p className="text-gray-600 text-sm font-medium">Next-Gen Management Platform</p>
                        <Zap className="w-4 h-4 text-amber-500 animate-pulse flex-shrink-0" />
                      </div>
                    </div>
                  </div>

                  
                </div>

                {/* Divider */}
                <div className="relative mb-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 bg-white text-gray-500 text-sm font-medium">
                      Sign in to continue
                    </span>
                  </div>
                </div>

                {/* Form Header */}
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-md">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
                        Welcome Back
                      </h2>
                    </div>
                  </div>
                  <p className="text-gray-600 text-base">
                    Enter your credentials to access your dashboard
                  </p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Email Field */}
                  <div className="group">
                    <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-orange-500" />
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-400 to-amber-400 rounded-xl opacity-0 group-hover:opacity-10 blur transition-opacity"></div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <div className="w-8 h-8 bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg flex items-center justify-center">
                            <Mail className="h-4 w-4 text-orange-600" />
                          </div>
                        </div>
                        <input
                          id="email"
                          name="email"
                          type="text"
                          inputMode="email"
                          autoComplete="email"
                          required
                          className="block w-full pl-14 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all placeholder-gray-400 hover:border-gray-300 hover:bg-white"
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="group">
                    <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-orange-500" />
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-400 to-amber-400 rounded-xl opacity-0 group-hover:opacity-10 blur transition-opacity"></div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <div className="w-8 h-8 bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg flex items-center justify-center">
                            <Lock className="h-4 w-4 text-orange-600" />
                          </div>
                        </div>
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          required
                          className="block w-full pl-14 pr-14 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all placeholder-gray-400 hover:border-gray-300 hover:bg-white"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-orange-600 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="relative overflow-hidden rounded-xl bg-red-50 border-2 border-red-200 p-4 animate-shake">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span className="text-white text-xs font-bold">✕</span>
                        </div>
                        <div className="text-sm text-red-800 font-medium">{error}</div>
                      </div>
                    </div>
                  )}

                  {/* Sign In Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="relative w-full group/btn overflow-hidden"
                  >
                    <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 rounded-xl blur-lg opacity-30 group-hover/btn:opacity-50 transition-opacity"></div>
                    <div className="relative flex items-center justify-center py-4 px-6 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 rounded-xl text-white font-bold text-base shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform-gpu group-hover/btn:scale-[1.02] active:scale-[0.98] transition-all duration-300">
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                      <div className="absolute inset-0 opacity-0 group-hover/btn:opacity-30 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.8),transparent_60%)] transition-opacity"></div>
                      <span className="relative flex items-center gap-2">
                        {isLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-3 border-white border-t-transparent"></div>
                            <span>Signing in...</span>
                          </>
                        ) : (
                          <>
                            <span>Sign In to Dashboard</span>
                            <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                          </>
                        )}
                      </span>
                    </div>
                  </button>
                </form>

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Animations & Styles */}
      <style jsx>{`
        @keyframes gradient-x {
          0%, 100% {
            background-size: 200% 200%;
            background-position: left center;
          }
          50% {
            background-size: 200% 200%;
            background-position: right center;
          }
        }
        
        @keyframes fade-in-down {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        
        @keyframes float {
          0%, 100% { 
            transform: translate(0, 0) scale(1);
          }
          33% { 
            transform: translate(30px, -30px) scale(1.1);
          }
          66% { 
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        
        @keyframes float-delayed {
          0%, 100% { 
            transform: translate(0, 0) scale(1) rotate(0deg);
          }
          33% { 
            transform: translate(-30px, 30px) scale(1.1) rotate(5deg);
          }
          66% { 
            transform: translate(20px, -20px) scale(0.9) rotate(-5deg);
          }
        }
        
        @keyframes float-particle {
          0%, 100% { 
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% { 
            transform: translateY(-100vh) translateX(20px);
            opacity: 0;
          }
        }
        
        @keyframes float-particle-delayed {
          0%, 100% { 
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% { 
            transform: translateY(-100vh) translateX(-20px);
            opacity: 0;
          }
        }
        
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }
        
        @keyframes ping-slow {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        
        @keyframes progress {
          0% {
            transform: scaleX(0);
            transform-origin: left;
          }
          100% {
            transform: scaleX(1);
            transform-origin: left;
          }
        }
        
        .animate-gradient-x {
          animation: gradient-x 3s ease infinite;
        }
        
        .animate-fade-in-down {
          animation: fade-in-down 0.8s ease-out;
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 1s ease-out 0.3s both;
        }
        
        .animate-shake {
          animation: shake 0.6s ease-in-out;
        }
        
        .animate-float {
          animation: float 8s ease-in-out infinite;
        }
        
        .animate-float-delayed {
          animation: float-delayed 10s ease-in-out infinite;
        }
        
        .animate-float-particle {
          animation: float-particle 8s ease-in-out infinite;
        }
        
        .animate-float-particle-delayed {
          animation: float-particle-delayed 10s ease-in-out infinite 2s;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        
        .animate-ping-slow {
          animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        
        .animate-progress {
          animation: progress 12s linear;
        }
      `}</style>
    </div>
  );
}