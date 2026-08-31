"use client";

import { useCallback, useRef, useState } from "react";

import { parseCsvFile } from "@/lib/csv/parser";
import type { CsvData } from "@/lib/types";

interface CsvUploaderProps {
  onData: (data: CsvData) => void;
}

/** Área de upload do CSV com suporte a arrastar-e-soltar. */
export function CsvUploader({ onData }: CsvUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFile, setLoadedFile] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setError("Selecione um arquivo .csv.");
        return;
      }
      try {
        const data = await parseCsvFile(file);
        setLoadedFile(file.name);
        onData(data);
      } catch (err) {
        setLoadedFile(null);
        setError(err instanceof Error ? err.message : "Falha ao ler o arquivo.");
      }
    },
    [onData],
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFile(e.dataTransfer.files[0]);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragging
            ? "border-blue-500 bg-blue-50"
            : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40"
        }`}
      >
        <svg
          className="mb-2 h-8 w-8 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
          />
        </svg>
        <p className="text-sm font-medium text-slate-700">
          Arraste o arquivo CSV aqui ou clique para selecionar
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Primeira linha deve conter o cabeçalho das colunas
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {loadedFile && !error && (
        <p className="mt-2 text-sm text-emerald-700">
          Arquivo carregado: <strong>{loadedFile}</strong>
        </p>
      )}
    </div>
  );
}
