import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { indexedDBService, StoredImage } from './utils/indexedDB';

export default function HomePage() {
  const [isDragging, setIsDragging] = useState(false);
  const [recentImages, setRecentImages] = useState<StoredImage[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showDeleteMenu, setShowDeleteMenu] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Load recent images from IndexedDB on component mount
    const loadRecentImages = async () => {
      try {
        const images = await indexedDBService.getRecentProjects(10);
        setRecentImages(images);
      } catch (error) {
        console.error('Failed to load projects:', error);
      }
    };

    loadRecentImages();
  }, []);

  useEffect(() => {
    // Focus the input when editing starts
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processImage(files[0]);
    }
  }, []);

  const isValidImageType = (file: File): boolean => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    return validTypes.includes(file.type);
  };

  const processImage = async (file: File) => {
    if (!isValidImageType(file)) {
      alert('Please upload a valid image file (PNG, JPG, JPEG, or WEBP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const imageDataUrl = reader.result as string;
      // Generate a random ID for the image
      const id = Math.random().toString(36).substring(2, 15);
      
      // Use the filename without extension as the default name
      const fileName = file.name;
      const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
      
      // Store the image in IndexedDB
      const storedImage: StoredImage = {
        id,
        dataUrl: imageDataUrl,
        name: nameWithoutExt,
        uploadedAt: new Date().toISOString()
      };
      
      try {
        await indexedDBService.addProject(storedImage);
        
        // Update recent images list
        const updatedImages = [storedImage, ...recentImages].slice(0, 10);
        setRecentImages(updatedImages);
        
        // Redirect to editor page
        navigate(`/editor/${id}`);
      } catch (error) {
        console.error('Failed to save project:', error);
        alert('Failed to save project. Please try again.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleManualUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processImage(e.target.files[0]);
    }
  };

  const openImageInEditor = (id: string) => {
    navigate(`/editor/${id}`);
  };

  const startEditing = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the editor
    setEditingId(id);
    setEditName(currentName);
  };

  const saveEdit = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); // Prevent opening the editor
    
    if (editingId && editName.trim()) {
      try {
        // Find the project to update
        const projectToUpdate = recentImages.find(img => img.id === editingId);
        if (projectToUpdate) {
          // Update the project in IndexedDB
          const updatedProject = { ...projectToUpdate, name: editName.trim() };
          await indexedDBService.updateProject(updatedProject);
          
          // Update the UI
          const updatedImages = recentImages.map(img => 
            img.id === editingId ? updatedProject : img
          );
          setRecentImages(updatedImages);
        }
        
        setEditingId(null);
        setEditName('');
      } catch (error) {
        console.error('Failed to update project:', error);
        alert('Failed to update project name. Please try again.');
      }
    }
  };

  const cancelEdit = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); // Prevent opening the editor
    setEditingId(null);
    setEditName('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the editor
    
    // For desktop - show confirmation immediately
    if (window.innerWidth > 768) {
      setDeleteConfirmId(id);
    } else {
      // For mobile - show the delete menu
      setShowDeleteMenu(id);
    }
  };

  const confirmDelete = async (id: string) => {
    try {
      // Delete from IndexedDB
      await indexedDBService.deleteProject(id);
      
      // Update UI
      const updatedImages = recentImages.filter(img => img.id !== id);
      setRecentImages(updatedImages);
      
      // If we were editing this image, cancel edit
      if (editingId === id) {
        cancelEdit();
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project. Please try again.');
    } finally {
      // Close any open menus
      setShowDeleteMenu(null);
      setDeleteConfirmId(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteMenu(null);
    setDeleteConfirmId(null);
  };

  // Handle long press on mobile
  const handleTouchStart = (id: string) => {
    longPressTimerRef.current = setTimeout(() => {
      setShowDeleteMenu(id);
    }, 500); // 500ms delay for long press
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showDeleteMenu && !(e.target as Element).closest('.delete-menu')) {
        setShowDeleteMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDeleteMenu]);

  return (
    <div className="min-h-screen flex flex-col items-center p-4" style={{ backgroundColor: 'oklch(0.1913 0 0)' }}>
      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-4">Delete Project</h3>
            <p className="text-gray-300 mb-6">Are you sure you want to delete this project? This action cannot be undone.</p>
            <div className="flex space-x-4 justify-end">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(deleteConfirmId)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-center mb-8 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <img 
            src="/images/logo.svg" 
            alt="Blurr Logo" 
            className="h-32 w-32 md:h-40 md:w-40"
            onError={(e) => {
              e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iIzdDN0Y4RiIvPgo8cGF0aCBkPSJNMTIgMTZMMTYgMTJNMTIgMTZMOCAxMk0xMgxNlY4IiBzdHJva2U9IiM1QjZDOEMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=';
            }}
          />
        </div>
        <p className="text-xl text-gray-300">Edit images with ease for Free.</p>
      </div>

      <div className="w-full max-w-md mb-8">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 md:p-8 text-center cursor-pointer transition-colors ${
            isDragging ? 'border-blue-400 bg-blue-900/20' : 'border-gray-500 hover:border-gray-400'
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-4">
            <svg className="w-10 h-10 md:w-12 md:h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {isDragging ? (
              <p className="text-blue-400 font-medium">Drop the image here</p>
            ) : (
              <>
                <p className="text-gray-300">Drag & drop an image here</p>
                <p className="text-gray-400 text-sm">Supports: PNG, JPG, JPEG, WEBP</p>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col space-y-3">
          <button
            onClick={handleManualUpload}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Upload Image
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".png,.jpg,.jpeg,.webp"
            className="hidden"
          />
        </div>
      </div>

      {recentImages.length > 0 && (
        <div className="w-full max-w-6xl">
          <h2 className="text-xl font-semibold text-white mb-4">Recent Projects</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {recentImages.map((image) => (
              <div 
                key={image.id} 
                className="bg-gray-800 rounded-lg overflow-hidden hover:shadow-lg transition-all relative group"
              >
                <div 
                  className="aspect-square overflow-hidden cursor-pointer relative"
                  onClick={() => openImageInEditor(image.id)}
                  onTouchStart={() => handleTouchStart(image.id)}
                  onTouchEnd={handleTouchEnd}
                  onTouchMove={handleTouchMove}
                >
                  <img 
                    src={image.dataUrl} 
                    alt={image.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                  
                  {/* Desktop Delete Button */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleDeleteClick(image.id, e)}
                      className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-full"
                      title="Delete project"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Mobile Delete Menu */}
                {showDeleteMenu === image.id && (
                  <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-10 md:hidden delete-menu">
                    <div className="bg-gray-800 rounded-lg p-4">
                      <p className="text-white mb-3 text-center">Delete this project?</p>
                      <div className="flex space-x-3 justify-center">
                        <button
                          onClick={cancelDelete}
                          className="px-3 py-1 bg-gray-600 text-white rounded-lg text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => confirmDelete(image.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="p-3">
                  {editingId === image.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={handleKeyPress}
                        className="flex-1 bg-gray-700 text-white rounded px-2 py-1 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => saveEdit(e)}
                        className="text-green-400 hover:text-green-300"
                        title="Save"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => cancelEdit(e)}
                        className="text-gray-400 hover:text-gray-300"
                        title="Cancel"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p 
                        className="text-gray-300 text-sm truncate cursor-text"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {image.name}
                      </p>
                      <button
                        onClick={(e) => startEditing(image.id, image.name, e)}
                        className="text-gray-400 hover:text-gray-300 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                        title="Edit title"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}