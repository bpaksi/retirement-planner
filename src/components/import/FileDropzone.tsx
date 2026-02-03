"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number;
  className?: string;
}

export function FileDropzone({
  onFileSelect,
  accept = ".csv",
  maxSize = 10 * 1024 * 1024, // 10MB default
  className,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!file.name.endsWith(".csv")) {
        return "Please select a CSV file";
      }
      if (file.size > maxSize) {
        return `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`;
      }
      return null;
    },
    [maxSize]
  );

  const handleFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);
      onFileSelect(file);
    },
    [onFileSelect, validateFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  return (
    <div className={className}>
      <div
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 transition-colors cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50",
          error && "border-destructive"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="flex flex-col items-center justify-center text-center">
          <div
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center mb-4",
              isDragging ? "bg-primary/10" : "bg-muted"
            )}
          >
            {isDragging ? (
              <FileText className="w-6 h-6 text-primary" />
            ) : (
              <Upload className="w-6 h-6 text-muted-foreground" />
            )}
          </div>

          <p className="text-sm font-medium text-foreground mb-1">
            {isDragging ? "Drop your file here" : "Drop your CSV file here"}
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            or click to browse
          </p>

          <p className="text-xs text-muted-foreground">
            Supports Capital One, Edward Jones, and custom CSV formats
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
