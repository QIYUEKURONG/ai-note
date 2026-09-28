"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { PetFigure } from "@/features/pet/PetFigure";
import { asPetKind, PETS, type PetKind } from "@/features/pet/pets";

export function ApiKeysPanel(props: { onSaved?: () => void }) {
  const [deepseek, setDeepseek] = useState("");
  const [ark, setArk] = useState("");
  const [hasDeepSeek, setHasDeepSeek] = useState(false);
  const [hasArk, setHasArk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pet, setPet] = useState<PetKind>("round");

  useEffect(() => {
    void api<{ settings: { hasDeepSeek: boolean; hasArk: boolean; pet_kind?: string } }>("/api/settings").then(
      (res) => {
        setHasDeepSeek(res.settings.hasDeepSeek);
        setHasArk(res.settings.hasArk);
        setPet(asPetKind(res.settings.pet_kind));
      },
    );
  }, []);

  async function choosePet(kind: PetKind) {
    setPet(kind);
    await api("/api/settings", { method: "PUT", body: JSON.stringify({ pet_kind: kind }) });
    window.dispatchEvent(new Event("mindbook-pet"));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          deepseek_api_key: deepseek,
          ark_api_key: ark,
        }),
      });
      if (deepseek.trim()) setHasDeepSeek(true);
      if (ark.trim()) setHasArk(true);
      setDeepseek("");
      setArk("");
      setMessage("已保存，对所有笔记生效");
      props.onSaved?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="side-panel global-keys-panel">
      <p className="panel-lead">选一只伙伴。桌面和笔记里是同一只。</p>
      <div className="pet-picks">
        {PETS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={pet === item.id ? "is-on" : ""}
            onClick={() => void choosePet(item.id)}
          >
            <PetFigure mood="idle" kind={item.id} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <p className="panel-lead">DeepSeek 负责文字，火山方舟负责生图。</p>
      <div className="keys">
        <label>
          DeepSeek API Key {hasDeepSeek ? "（已配置）" : ""}
          <input
            type="password"
            value={deepseek}
            placeholder={hasDeepSeek ? "已保存，留空不改" : "sk-..."}
            autoComplete="off"
            onChange={(event) => setDeepseek(event.target.value)}
          />
        </label>
        <label>
          火山方舟 API Key {hasArk ? "（已配置）" : ""}
          <input
            type="password"
            value={ark}
            placeholder={hasArk ? "已保存，留空不改" : "Ark key"}
            autoComplete="off"
            onChange={(event) => setArk(event.target.value)}
          />
        </label>
        <button className="btn" disabled={saving || (!deepseek.trim() && !ark.trim())} onClick={() => void save()}>
          {saving ? "保存中…" : "保存"}
        </button>
        {message ? <p className="keys-msg">{message}</p> : null}
      </div>
    </div>
  );
}
