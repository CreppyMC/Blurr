import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { indexedDBService, StoredImage } from './utils/indexedDB';

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const [image, setImage] = useState<StoredImage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadImage = async () => {
      if (!id) return;
      
      try {
        const project = await indexedDBService.getProject(id);
        setImage(project);
      } catch (error) {
        console.error('Failed to load project:', error);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'oklch(0.1913 0 0)' }}>
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!image) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: 'oklch(0.1913 0 0)' }}>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">404</h1>
          <p className="text-xl text-gray-300 mb-8">Image not found</p>
          <Link 
            to="/"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Go Back Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: 'oklch(0.1913 0 0)' }}>
      <header className="max-w-6xl mx-auto mb-8">
        <Link to="/" className="inline-flex items-center text-gray-300 hover:text-white transition-colors">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>
      </header>
      
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Image Editor</h1>
        <p className="text-gray-400 mb-8">Editing: {image.name}</p>
        
        <div className="bg-gray-800 rounded-lg p-4 mb-8">
          <div className="flex justify-center">
            <img 
              src={image.dataUrl} 
              alt={image.name}
              className="max-w-full max-h-96 object-contain"
            />
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Edit Tools</h2>
          <p className="text-gray-400 mb-4">Editor tools will be implemented here in the future.</p>
          <div className="flex space-x-4">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg opacity-50 cursor-not-allowed">
              Crop
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg opacity-50 cursor-not-allowed">
              Filter
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg opacity-50 cursor-not-allowed">
              Adjust
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}