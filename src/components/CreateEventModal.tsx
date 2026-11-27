import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  createSportEvent,
  geocodeLocationQuery,
  uploadMediaFile,
} from '../services/firestoreService';
import type { SkillLevel, SportType } from '../types/orca';
import { getSportMeta, SPORTS_CATALOG } from '../utils/sports';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (result: { eventId: string; chatId: string }) => void;
}

const LEVELS: SkillLevel[] = ['Iniciante', 'Intermediário', 'Avançado', 'Todos'];

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { userProfile, coords, detectedCity, requestGeolocation } = useAuth();

  const [step, setStep] = useState(1);
  const [sportSearch, setSportSearch] = useState('');
  const [sport, setSport] = useState<SportType>('Futebol');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState<SkillLevel>('Intermediário');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');

  const defaultLocalDateTime = useMemo(() => {
    const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }, []);

  const [dateTimeInput, setDateTimeInput] = useState(defaultLocalDateTime);
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [maxParticipants, setMaxParticipants] = useState(12);
  const [price, setPrice] = useState(0);

  const [venueName, setVenueName] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [resolvedLat, setResolvedLat] = useState<number | null>(coords?.lat ?? null);
  const [resolvedLng, setResolvedLng] = useState<number | null>(coords?.lng ?? null);
  const [resolvedCity, setResolvedCity] = useState(detectedCity || userProfile?.city || '');
  const [geocoding, setGeocoding] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredSports = SPORTS_CATALOG.filter((s) =>
    s.label.toLowerCase().includes(sportSearch.toLowerCase().trim())
  );

  const handleUseMyGps = () => {
    if (coords) {
      setResolvedLat(coords.lat);
      setResolvedLng(coords.lng);
      setResolvedCity(detectedCity || userProfile?.city || '');
      setErrorMsg(null);
    } else {
      requestGeolocation();
      setErrorMsg('Solicitamos acesso ao seu GPS. Aguarde a confirmação do navegador ou busque o endereço abaixo.');
    }
  };

  const handleSearchAddress = async () => {
    if (!addressQuery.trim()) return;
    setGeocoding(true);
    setErrorMsg(null);
    const hit = await geocodeLocationQuery(addressQuery);
    setGeocoding(false);
    if (!hit) {
      setErrorMsg('Endereço não encontrado. Tente incluir cidade e estado ou use seu GPS atual.');
      return;
    }
    setResolvedLat(hit.lat);
    setResolvedLng(hit.lng);
    if (hit.city) setResolvedCity(hit.city);
    if (!venueName.trim()) {
      setVenueName(addressQuery.trim().slice(0, 80));
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    const url = URL.createObjectURL(file);
    setCoverPreview(url);
  };

  const handleNext = () => {
    setErrorMsg(null);
    if (step === 2 && title.trim().length < 3) {
      setErrorMsg('Dê um título com pelo menos 3 caracteres para o evento.');
      return;
    }
    if (step === 3) {
      const ts = new Date(dateTimeInput).getTime();
      if (!Number.isFinite(ts) || ts < Date.now() - 15 * 60 * 1000) {
        setErrorMsg('Escolha uma data e horário futuros válidos.');
        return;
      }
    }
    if (step === 4) {
      if (venueName.trim().length < 2) {
        setErrorMsg('Informe o nome da quadra, arena ou ponto de encontro.');
        return;
      }
      if (resolvedLat === null || resolvedLng === null) {
        if (coords) {
          setResolvedLat(coords.lat);
          setResolvedLng(coords.lng);
        } else {
          setErrorMsg('Defina a localização real via GPS ou busca de endereço antes de continuar.');
          return;
        }
      }
    }
    setStep((s) => Math.min(5, s + 1));
  };

  const handlePublish = async () => {
    if (!userProfile) return;
    const lat = resolvedLat ?? coords?.lat;
    const lng = resolvedLng ?? coords?.lng;
    if (lat === undefined || lat === null || lng === undefined || lng === null) {
      setErrorMsg('Coordenadas reais não definidas. Volte à etapa de localização.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      let coverURL = getSportMeta(sport).coverURL;
      if (coverFile) {
        try {
          coverURL = await uploadMediaFile(userProfile.uid, 'events', coverFile);
        } catch {
          // Fallback cleanly to sport cover if storage bucket policy is restricted
          coverURL = getSportMeta(sport).coverURL;
        }
      }

      const startsAtMs = new Date(dateTimeInput).getTime();
      const result = await createSportEvent(
        {
          title: title.trim(),
          description: description.trim(),
          sport,
          level,
          venueName: venueName.trim(),
          address: addressQuery.trim(),
          city: resolvedCity.trim(),
          lat,
          lng,
          startsAtMs,
          durationMinutes,
          price,
          maxParticipants,
          coverURL,
        },
        userProfile
      );
      onCreated(result);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao publicar evento. Tente novamente.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#0B0E15] border border-white/10 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/8 space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => (step > 1 ? setStep((s) => s - 1) : onClose())}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-200 cursor-pointer"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <div className="text-sm font-display font-bold text-white">
                Criar Evento
              </div>
              <div className="text-xs text-slate-400 font-mono-num">
                Etapa {step} de 5
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 5-step progress indicator */}
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-colors ${
                  idx <= step
                    ? 'bg-gradient-to-r from-rose-500 to-cyan-400'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="text-xs text-rose-200 bg-rose-500/15 border border-rose-500/30 rounded-xl px-4 py-3">
              {errorMsg}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-display font-bold leading-tight">
                Qual esporte você quer jogar?
              </h2>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5" />
                <input
                  type="text"
                  value={sportSearch}
                  onChange={(e) => setSportSearch(e.target.value)}
                  placeholder="Buscar esporte"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#111520] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredSports.map((item) => {
                  const selected = sport === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSport(item.id)}
                      className={`group rounded-2xl overflow-hidden border text-left transition-all cursor-pointer ${
                        selected
                          ? 'border-cyan-400 ring-2 ring-cyan-400/30 bg-[#141A29]'
                          : 'border-white/10 bg-[#10141E] hover:border-white/25'
                      }`}
                    >
                      <div className="h-20 relative overflow-hidden">
                        <img
                          src={item.coverURL}
                          alt={item.label}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#10141E] via-black/25 to-transparent" />
                      </div>
                      <div className="p-3 flex items-center justify-between">
                        <span className="text-xs font-semibold text-white truncate">
                          {item.label}
                        </span>
                        {selected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-display font-bold">
                Detalhes da partida
              </h2>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">
                  Título do evento
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`Ex.: ${sport} na Quadra Central`}
                  className="w-full px-4 py-3 rounded-xl bg-[#111520] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">
                  Nível dos atletas
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setLevel(lvl)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-semibold border cursor-pointer ${
                        level === lvl
                          ? 'bg-white text-slate-950 border-white'
                          : 'bg-[#111520] text-slate-300 border-white/10 hover:border-white/25'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">
                  Descrição e regras (opcional)
                </label>
                <textarea
                  rows={3}
                  maxLength={600}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Equipamento necessário, ponto de encontro, ritmo do jogo..."
                  className="w-full px-4 py-3 rounded-xl bg-[#111520] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 block">
                  Imagem de capa (opcional)
                </label>
                <label className="flex items-center gap-3 p-3 rounded-xl bg-[#111520] border border-dashed border-white/15 hover:border-cyan-400/50 cursor-pointer">
                  <ImageIcon className="w-5 h-5 text-cyan-400 shrink-0" />
                  <span className="text-xs text-slate-300 truncate">
                    {coverFile ? coverFile.name : 'Enviar foto do local ou usar capa do esporte'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverChange}
                    className="hidden"
                  />
                </label>
                {coverPreview && (
                  <img
                    src={coverPreview}
                    alt="Prévia da capa"
                    className="h-28 w-full object-cover rounded-xl border border-white/10"
                  />
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-display font-bold">
                Horário, vagas e valor
              </h2>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  Data e hora de início
                </label>
                <input
                  type="datetime-local"
                  value={dateTimeInput}
                  onChange={(e) => setDateTimeInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#111520] border border-white/10 text-sm text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Duração (min)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={480}
                    step={15}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-[#111520] border border-white/10 text-sm font-mono-num text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Máx. de atletas
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={200}
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-[#111520] border border-white/10 text-sm font-mono-num text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">
                  Valor por atleta (R$ — 0 para Gratuito)
                </label>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  step={5}
                  value={price}
                  onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))}
                  className="w-full px-4 py-3 rounded-xl bg-[#111520] border border-white/10 text-sm font-mono-num text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-display font-bold">
                Localização real da arena
              </h2>
              <button
                type="button"
                onClick={handleUseMyGps}
                className="w-full py-3 px-4 rounded-xl bg-cyan-500/12 hover:bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <MapPin className="w-4 h-4" />
                {coords ? 'Usar minha localização GPS atual' : 'Ativar GPS para preencher coordenadas'}
              </button>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">
                  Nome do local / quadra / parque
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="Ex.: Parque Ibirapuera — Quadra 3"
                  className="w-full px-4 py-3 rounded-xl bg-[#111520] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">
                  Buscar endereço real no mapa
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={addressQuery}
                    onChange={(e) => setAddressQuery(e.target.value)}
                    placeholder="Rua, bairro, cidade..."
                    className="flex-1 px-4 py-3 rounded-xl bg-[#111520] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={geocoding}
                    onClick={() => void handleSearchAddress()}
                    className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer shrink-0"
                  >
                    {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
                  </button>
                </div>
              </div>

              {resolvedLat !== null && resolvedLng !== null && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-200 flex items-center justify-between gap-2">
                  <span className="truncate">
                    Coordenadas reais vinculadas{resolvedCity ? ` · ${resolvedCity}` : ''}
                  </span>
                  <span className="font-mono-num shrink-0">
                    {resolvedLat.toFixed(4)}, {resolvedLng.toFixed(4)}
                  </span>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-display font-bold">
                Revisar e publicar
              </h2>
              <div className="rounded-2xl bg-[#111520] border border-white/10 p-4 space-y-3">
                <div className="text-xs font-semibold text-cyan-400">{sport} · {level}</div>
                <div className="text-lg font-display font-bold text-white">{title}</div>
                {description && (
                  <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
                )}
                <div className="pt-2 border-t border-white/8 space-y-1.5 text-xs text-slate-300">
                  <div>Local: {venueName} {resolvedCity ? `· ${resolvedCity}` : ''}</div>
                  <div>
                    Início: {new Date(dateTimeInput).toLocaleString('pt-BR')} · {durationMinutes} min
                  </div>
                  <div>
                    Capacidade: {maxParticipants} atletas ·{' '}
                    {price <= 0 ? 'Gratuito' : `R$ ${price.toFixed(2)}`}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Ao publicar, um canal de chat em tempo real será criado automaticamente para os atletas inscritos.
              </p>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="p-5 border-t border-white/8 bg-[#090B10]">
          {step < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="w-full py-3.5 px-6 rounded-2xl orca-gradient-btn text-white font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              Continuar
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handlePublish()}
              className="w-full py-3.5 px-6 rounded-2xl orca-gradient-btn text-white font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Publicando evento...
                </>
              ) : (
                <>
                  Publicar Evento (+120 XP)
                  <Check className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
