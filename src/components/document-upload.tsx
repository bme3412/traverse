"use client";

/**
 * Document Upload Component
 *
 * Drag-and-drop multi-file upload zone for visa documents.
 * - Accepts PNG and JPEG only
 * - Client-side base64 encoding
 * - Max 5MB per file, 12 files total
 * - Thumbnail previews
 */

import { useState, useRef, useCallback } from "react";
import { UploadedDocument } from "@/lib/types";
import { useTranslation } from "@/lib/i18n-context";
import { Upload, X, FileImage, AlertCircle } from "lucide-react";

interface DocumentUploadProps {
  documents: UploadedDocument[];
  onDocumentsChange: (documents: UploadedDocument[]) => void;
  onAnalyze: () => void;
  isAnalyzing?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
}

export function DocumentUpload({
  documents,
  onDocumentsChange,
  onAnalyze,
  isAnalyzing = false,
  maxFiles = 12,
  maxSizeMB = 5,
}: DocumentUploadProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!file.type.match(/^image\/(png|jpeg)$/)) {
      return `${file.name}: Only PNG and JPEG images are allowed`;
    }

    // Check file size
    if (file.size > maxSizeBytes) {
      return `${file.name}: File size must be under ${maxSizeMB}MB`;
    }

    return null;
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processFiles = useCallback(
    async (fileList: FileList) => {
      setError(null);

      const files = Array.from(fileList);

      // Check total count
      if (documents.length + files.length > maxFiles) {
        setError(`Maximum ${maxFiles} files allowed`);
        return;
      }

      // Validate each file
      for (const file of files) {
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          return;
        }
      }

      // Convert to base64 and create document objects
      try {
        const newDocuments: UploadedDocument[] = await Promise.all(
          files.map(async (file) => ({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            filename: file.name,
            base64: await fileToBase64(file),
            mimeType: file.type as "image/png" | "image/jpeg",
            sizeBytes: file.size,
          }))
        );

        onDocumentsChange([...documents, ...newDocuments]);
      } catch (err) {
        setError("Failed to process files. Please try again.");
      }
    },
    [documents, maxFiles, onDocumentsChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
      }
    },
    [processFiles]
  );

  const removeDocument = (id: string) => {
    onDocumentsChange(documents.filter((doc) => doc.id !== id));
    setError(null);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={openFilePicker}
        className={`
          border-2 border-dashed rounded-lg p-8 transition-all cursor-pointer
          ${
            isDragging
              ? "border-blue-500 bg-blue-500/10"
              : "border-border hover:border-border hover:bg-muted/50"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
            <Upload className="w-6 h-6 text-muted-foreground" />
          </div>

          <div>
            <p className="text-sm font-medium text-foreground">
              {t("Drop your documents here, or click to browse")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG or JPEG • Max {maxSizeMB}MB • Up to {maxFiles} files
            </p>
          </div>

          <div className="text-xs text-muted-foreground">
            {documents.length} {t("of")} {maxFiles} {t("files uploaded")}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/30">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Document Previews */}
      {documents.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">
            {t("Uploaded Documents")} ({documents.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="relative group border border-border rounded-lg overflow-hidden hover:border-border transition-colors"
              >
                {/* Thumbnail */}
                <div className="aspect-[3/4] bg-card flex items-center justify-center">
                  <img
                    src={`data:${doc.mimeType};base64,${doc.base64}`}
                    alt={doc.filename}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeDocument(doc.id)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove document"
                >
                  <X className="w-4 h-4 text-white" />
                </button>

                {/* Filename */}
                <div className="p-2 bg-card/90 backdrop-blur-sm">
                  <div className="flex items-center gap-1">
                    <FileImage className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs text-foreground truncate" title={doc.filename}>
                      {doc.filename}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(doc.sizeBytes / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analyze Button */}
      {documents.length > 0 && (
        <div className="flex justify-end pt-4">
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-muted disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t("Analyzing Documents...")}
              </>
            ) : (
              `${t("Analyze")} ${documents.length} ${documents.length > 1 ? t("Documents") : t("Document")}`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
