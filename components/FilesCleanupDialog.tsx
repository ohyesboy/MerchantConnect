import React, { useState, useEffect } from 'react';
import { getProductIds, listStorageFolders, deleteStorageFolder } from '../services/firebaseService';

interface FilesCleanupDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FilesCleanupDialog: React.FC<FilesCleanupDialogProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [unusedFolders, setUnusedFolders] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscapeKey);
      return () => window.removeEventListener('keydown', handleEscapeKey);
    }
  }, [isOpen]);

  const handleClose = () => {
    setLogs([]);
    setUnusedFolders([]);
    setScanning(false);
    setDeleting(false);
    onClose();
  };

  const handleScan = async () => {
    setScanning(true);
    setLogs([]);
    setUnusedFolders([]);

    try {
      const addLog = (message: string) => {
        setLogs(prev => [...prev, message]);
        console.log(message);
      };

      addLog('Fetching product IDs from Firestore...');
      const productIds = await getProductIds();
      addLog(`Found ${productIds.length} products`);

      addLog('Listing storage folders...');
      const storageFolders = await listStorageFolders();
      addLog(`Found ${storageFolders.length} folders in storage`);

      const unused: string[] = [];
      addLog('Comparing folders with product IDs...');

      for (const folder of storageFolders) {
        if (!productIds.includes(folder)) {
          const message = `Unused folder found: ${folder}`;
          addLog(message);
          unused.push(folder);
        }
      }

      setUnusedFolders(unused);
      addLog(`\nScan complete! Found ${unused.length} unused folder(s)`);
    } catch (error) {
      const errorMsg = `Error during scan: ${error instanceof Error ? error.message : String(error)}`;
      setLogs(prev => [...prev, errorMsg]);
      console.error(errorMsg, error);
    } finally {
      setScanning(false);
    }
  };

  const handleDeleteUnused = async () => {
    if (unusedFolders.length === 0) {
      alert('No unused folders to delete');
      return;
    }

    if (!confirm(`Delete ${unusedFolders.length} unused folder(s)? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      const addLog = (message: string) => {
        setLogs(prev => [...prev, message]);
        console.log(message);
      };

      addLog(`\nDeleting ${unusedFolders.length} unused folder(s)...`);

      for (const folder of unusedFolders) {
        try {
          await deleteStorageFolder(folder);
          addLog(`✓ Deleted: ${folder}`);
        } catch (error) {
          addLog(`✗ Failed to delete ${folder}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      addLog('Deletion complete!');
      setUnusedFolders([]);
    } catch (error) {
      const errorMsg = `Error during deletion: ${error instanceof Error ? error.message : String(error)}`;
      setLogs(prev => [...prev, errorMsg]);
      console.error(errorMsg, error);
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-red-600 p-6 text-white">
          <h2 className="text-xl font-bold flex items-center">
            <i className="fas fa-trash-alt mr-3"></i>
            Files Cleanup
          </h2>
          <p className="text-red-100 text-sm mt-1">
            Find and delete unused product folders from storage
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleScan}
              disabled={scanning || deleting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-2 rounded-lg transition"
            >
              {scanning ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Scanning...
                </>
              ) : (
                <>
                  <i className="fas fa-search mr-2"></i>
                  Scan
                </>
              )}
            </button>
            <button
              onClick={handleDeleteUnused}
              disabled={deleting || unusedFolders.length === 0}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-semibold py-2 rounded-lg transition"
            >
              {deleting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Deleting...
                </>
              ) : (
                <>
                  <i className="fas fa-trash-alt mr-2"></i>
                  Delete unused files ({unusedFolders.length})
                </>
              )}
            </button>
          </div>

          {/* Logs */}
          <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-slate-500">Click "Cleanup" to start scanning...</p>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="py-0.5">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-6 flex gap-3 justify-end bg-white">
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

