import React, { useEffect, useState } from "react";

import { 
  Bars3Icon, 
  XMarkIcon, 
  MicrophoneIcon, 
  HomeIcon, 
  UserGroupIcon,
  ArrowPathIcon,
  UserCircleIcon
} from "@heroicons/react/24/outline";
import { SunIcon, MoonIcon } from "@heroicons/react/24/solid";


const Navbar = ({ darkMode, setDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
 
  
  const toggleMenu = () => setIsOpen(!isOpen);

 
  

  return (
  
      <nav className={`sticky top-0 z-50 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} shadow-lg`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <a href="/" className="flex items-center space-x-2">
                <MicrophoneIcon className={`h-8 w-8 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                <span className="flex items-center text-3xl font-bold">
                  <span className={darkMode ? "text-amber-200" : "text-brown-700"}>thenga</span>
                  <span className={darkMode ? "text-green-400" : "text-green-700"}>Pod</span>
                </span>
              </a>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-1">
              <a
                href="/"
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  darkMode ? 'hover:bg-gray-700 hover:text-white' : 'hover:bg-green-50 hover:text-green-600'
                }`}
              >
                <HomeIcon className="h-5 w-5 mr-2" />
                Home
              </a>
            
              {/* <a
                href="/studio"
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  darkMode ? 'bg-green-700 hover:bg-green-600' : 'bg-green-600 hover:bg-green-700'
                } text-white`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6v-2z" />
                </svg>
                Create Podcast
              </a> */}

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 ml-2 rounded-full ${
                  darkMode ? 'bg-gray-700 text-yellow-300' : 'bg-green-100 text-gray-700'
                }`}
              >
                {darkMode ? (
                  <SunIcon className="h-5 w-5" />
                ) : (
                  <MoonIcon className="h-5 w-5" />
                )}
              </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex items-center md:hidden">
              <button
                onClick={toggleMenu}
                className={`inline-flex items-center justify-center p-2 rounded-md ${
                  darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-800 hover:bg-green-50'
                }`}
              >
                {isOpen ? (
                  <XMarkIcon className="h-6 w-6" />
                ) : (
                  <Bars3Icon className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className={`md:hidden ${darkMode ? 'bg-gray-800' : 'bg-white'} border-t ${
            darkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <a
                href="/"
                className={`flex items-center px-3 py-2 rounded-md text-base font-medium ${
                  darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-800 hover:bg-green-50'
                }`}
              >
                <HomeIcon className="h-5 w-5 mr-2" />
                Home
              </a>
              {/* <a href="">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6v-2z" />
                </svg>
                Create Room
              </a> */}
           
                

              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`w-full flex items-center px-3 py-2 rounded-md text-base font-medium ${
                  darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-800 hover:bg-green-50'
                }`}
              >
                {darkMode ? (
                  <>
                    <SunIcon className="h-5 w-5 mr-2" />
                    Light Mode
                  </>
                ) : (
                  <>
                    <MoonIcon className="h-5 w-5 mr-2" />
                    Dark Mode
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Background overlay */}
            <div 
              className={`fixed inset-0 ${darkMode ? 'bg-opacity-0' : 'bg-opacity-0'}`}
              onClick={() => setShowAuthModal(false)}
            ></div>
            
            {/* Modal content */}
            <div className={`relative transform overflow-hidden rounded-lg shadow-xl transition-all w-full max-w-md mx-4 ${
              darkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              <div className="px-6 pt-8 pb-6 sm:p-8">
                <div className="flex flex-col items-center">
                  {/* Logo Section */}
                  <div className="flex items-center justify-center mb-6">
                    <MicrophoneIcon className={`h-10 w-10 ${darkMode ? 'text-green-400' : 'text-green-600'} mr-2`} />
                    <span className="text-2xl font-bold">
                      <span className={darkMode ? "text-amber-200" : "text-brown-700"}>thenga</span>
                      <span className={darkMode ? "text-green-400" : "text-green-700"}>PodCast</span>
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className={`text-xl font-semibold leading-6 mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Sign in to Your Account
                  </h3>

                  {/* Auth Content */}
                  <div className="w-full">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center py-6">
                        <ArrowPathIcon className="h-10 w-10 text-green-500 animate-spin mb-4" />
                        <p className={darkMode ? "text-gray-300" : "text-gray-600"}>Signing you in...</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex justify-center">
                          <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={handleGoogleError}
                            theme={darkMode ? "filled_black" : "outline"}
                            size="large"
                            text="signin_with"
                            shape="rectangular"
                            logo_alignment="left"
                            width="300"
                          />
                        </div>
                        <div className="relative my-6">
                          <div className="absolute inset-0 flex items-center">
                            <div className={`w-full border-t ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}></div>
                          </div>
                          <div className="relative flex justify-center">
                            <span className={`px-2 text-sm ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'}`}>
                              OR
                            </span>
                          </div>
                        </div>
                        {/* Additional sign-in options can be added here */}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer/Cancel Button */}
              <div className={`px-6 py-4 flex justify-center ${
                darkMode ? 'bg-gray-800 border-t border-gray-700' : 'bg-gray-50 border-t border-gray-200'
              }`}>
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className={`inline-flex justify-center rounded-md border px-4 py-2 text-base font-medium w-full sm:w-auto sm:text-sm ${
                    darkMode 
                      ? 'bg-gray-700 text-white hover:bg-gray-600 border-gray-600' 
                      : 'bg-white text-gray-700 hover:bg-gray-100 border-gray-300'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>
  
    
  );
};

export default Navbar;