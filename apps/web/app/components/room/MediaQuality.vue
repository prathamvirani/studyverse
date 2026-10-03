<script setup lang="ts">
import { StudySelect } from '@study/ui';
import { ref, watch, nextTick } from 'vue';
import { mediaQualitySchema, qualityPreset, voiceProfile } from '@study/contracts';
import type { QualityModel } from '../../room/rtc-quality';
import type { MediaTrack, MediaProfile } from '@study/feature-sdk';
const props = withDefaults(
  defineProps<{ model: QualityModel; tracks: readonly MediaTrack[]; section?: string }>(),
  { section: 'Quality' },
);
const draft = ref(mediaQualitySchema.parse(props.model.state.current));
const name = ref('');
watch(
  () => props.model.state.current,
  (value) => {
    draft.value = mediaQualitySchema.parse(value);
  },
);
const sources = ['camera', 'screen', 'cameraReceive', 'screenReceive'] as const;
const labels = {
  camera: 'Camera send',
  screen: 'Screen send',
  cameraReceive: 'Camera receive ceiling',
  screenReceive: 'Screen receive ceiling',
};
const resolutions = [
  [640, 360],
  [854, 480],
  [1280, 720],
  [1920, 1080],
  [2560, 1080],
  [2560, 1440],
  [2560, 1600],
  [3440, 1440],
  [3840, 2160],
];
function resolution(source: (typeof sources)[number], value: string) {
  draft.value[source].resolution = value === 'native' ? 'native' : 'fixed';
  if (value !== 'native' && value !== 'custom') {
    const [w, h] = value.split('x').map(Number);
    draft.value[source].width = w!;
    draft.value[source].height = h!;
  }
}
function resolutionChoice(source: (typeof sources)[number]) {
  const p = draft.value[source];
  if (p.resolution === 'native') return 'native';
  return resolutions.some(([w, h]) => w === p.width && h === p.height)
    ? `${p.width}x${p.height}`
    : 'custom';
}
function format(p?: MediaProfile) {
  return `${p?.resolution === 'native' ? 'Native (tier bounded)' : `${p?.width ?? '?'} × ${p?.height ?? '?'}`} · ${p?.fps ?? '?'} FPS · ${p?.codec ?? 'unknown codec'} · ${p?.bitrate === undefined ? 'unknown bitrate' : (p.bitrate / 1e6).toFixed(2) + ' Mbps'}`;
}
const fps = [24, 30, 50, 60, 75, 90, 100, 120, 144, 165, 200, 240, 250];
async function applyFrom(event?: Event, value = draft.value) {
  const control = event?.currentTarget as HTMLElement | undefined;
  await props.model.apply(value);
  await nextTick();
  if (control?.isConnected && document.activeElement === document.body) control.focus();
}
</script>

<template>
  <section class="media-quality" aria-label="Media quality">
    <p v-if="section !== 'Diagnostics'">
      Automatic, conservative quality by default. Capture always starts with your mic, camera or
      share button.
    </p>
    <fieldset v-if="section !== 'Diagnostics'" :disabled="!model.state.ready || model.state.busy">
      <legend>Personal preferences</legend>
      <template v-if="section === 'Quality' || section === 'Camera'">
        <label
          >Quality mode
          <StudySelect
            v-model="draft.mode"
            label="Quality mode"
            :options="[
              { value: 'basic', label: 'Basic' },
              { value: 'advanced', label: 'Advanced' },
            ]"
            @update:model-value="applyFrom()"
        /></label>
        <div class="quality-actions">
          <button
            v-for="preset in ['data-saver', 'balanced', 'high'] as const"
            :key="preset"
            type="button"
            @click="
              draft = qualityPreset(preset);
              applyFrom($event);
            "
          >
            {{
              preset === 'data-saver' ? 'Data Saver' : preset === 'balanced' ? 'Balanced' : 'High'
            }}
          </button>
        </div>
        <p>
          Quality adapts to this device and the room's supported limits. Advanced changes apply
          together to avoid repeatedly restarting a live stream.
        </p>
        <template v-if="draft.mode === 'advanced'">
          <p>
            Maximum / Custom is experimental. Source, encoder, network, receiver and negotiation can
            reduce quality. Native means no preferred size, within deployment limits; native refresh
            is unknown.
          </p>
          <details
            v-for="source in sources.filter(
              (s) => section !== 'Camera' || s === 'camera' || s === 'cameraReceive',
            )"
            :key="source"
            :open="source === 'camera'"
          >
            <summary>{{ labels[source] }}</summary>
            <label
              >Resolution preset
              <StudySelect
                :label="`${labels[source]} resolution preset`"
                :model-value="resolutionChoice(source)"
                :options="[
                  { value: 'custom', label: 'Custom dimensions' },
                  ...resolutions.map((r) => ({ value: r.join('x'), label: r.join(' × ') })),
                  { value: 'native', label: 'Native (within tier)' },
                ]"
                @update:model-value="resolution(source, $event)"
            /></label>
            <div class="quality-grid">
              <label
                >Requested width
                <input
                  v-model.number="draft[source].width"
                  :aria-label="`${labels[source]} width`"
                  type="number"
                  min="160"
                  max="7680"
                  :disabled="draft[source].resolution === 'native'"
              /></label>
              <label
                >Requested height
                <input
                  v-model.number="draft[source].height"
                  :aria-label="`${labels[source]} height`"
                  type="number"
                  min="90"
                  max="4320"
                  :disabled="draft[source].resolution === 'native'"
              /></label>
            </div>
            <label
              >FPS preset
              <StudySelect
                :label="`${labels[source]} FPS preset`"
                :model-value="draft[source].fps === null ? 'native' : String(draft[source].fps)"
                :options="[
                  { value: 'native', label: 'Native / Auto' },
                  ...(draft[source].fps !== null && !fps.includes(draft[source].fps)
                    ? [{ value: String(draft[source].fps), label: 'Custom' }]
                    : []),
                  ...fps.map((f) => ({ value: String(f), label: String(f) })),
                ]"
                @update:model-value="
                  draft[source].fps = $event === 'native' ? null : Number($event)
                "
            /></label>
            <label
              >Custom FPS (1–250)
              <input
                v-model.number="draft[source].fps"
                :aria-label="`${labels[source]} FPS`"
                type="number"
                min="1"
                max="250"
                step="0.1"
            /></label>
            <template v-if="source === 'camera' || source === 'screen'">
              <label
                >Bitrate ceiling (bits/s)
                <input
                  v-model.number="draft[source].bitrate"
                  :aria-label="`${labels[source]} bitrate`"
                  type="number"
                  min="100000"
                  max="50000000"
                  step="100000"
              /></label>
              <label
                >Codec preference
                <StudySelect
                  v-model="draft[source].codec"
                  :label="`${labels[source]} codec`"
                  :options="[
                    { value: 'auto', label: 'Auto' },
                    ...['av1', 'vp9', 'h264', 'vp8'].map((codec) => ({
                      value: codec,
                      label:
                        codec.toUpperCase() +
                        (model.capabilities?.codecs.includes(codec)
                          ? ' · advertised'
                          : ' · unavailable / unknown'),
                      disabled: !model.capabilities?.codecs.includes(codec),
                    })),
                  ]"
              /></label>
              <label
                >Quality / latency priority
                <StudySelect
                  v-model="draft[source].priority"
                  label="Quality / latency priority"
                  :options="[
                    { value: 'balanced', label: 'Balanced' },
                    { value: 'quality', label: 'Quality · preserve resolution' },
                    { value: 'latency', label: 'Latency / motion · preserve FPS' },
                  ]"
              /></label>
              <label
                >Layers
                <StudySelect
                  v-model="draft[source].layers"
                  label="Layers"
                  :options="[
                    { value: 'auto', label: 'Auto' },
                    { value: 'off', label: 'Single spatial layer' },
                    { value: 'simulcast', label: 'Simulcast (VP8 / H264)' },
                    { value: 'svc', label: 'SVC (VP9 / AV1)' },
                  ]"
              /></label>
              <label
                >Content type
                <StudySelect
                  v-model="draft[source].content"
                  label="Content type"
                  :options="[
                    { value: 'motion', label: 'Motion' },
                    { value: 'detail', label: 'Detail / presentation' },
                    { value: 'text', label: 'Text' },
                  ]"
              /></label>
              <label
                ><input v-model="draft[source].preserveAspectRatio" type="checkbox" /> Preserve
                source aspect ratio</label
              >
            </template>
            <p v-else>
              Receive is a useful render-size ceiling, not a guarantee of an exact SFU layer.
              Receive bitrate and codec are negotiated by the sender/provider.
            </p>
          </details>
          <p>
            Layer mode follows the negotiated codec. Latency is an encoder tradeoff, not a latency
            guarantee. Hardware encoder selection is unavailable.
          </p>
        </template>
      </template>
      <template v-if="section === 'Audio'">
        <label
          >Voice preset
          <StudySelect
            v-model="draft.audio.mode"
            label="Voice preset"
            :options="[
              { value: 'standard', label: 'Standard' },
              { value: 'high', label: 'High' },
              { value: 'studio', label: 'Studio Voice' },
            ]"
            @update:model-value="
              draft.audio = voiceProfile(draft.audio.mode);
              applyFrom();
            "
        /></label>
        <p v-if="draft.audio.mode === 'studio'">
          Studio Voice requests 48 kHz Opus with processing off. Use headphones to avoid echo.
          Browser support varies; this is not lossless audio.
        </p>
        <template v-if="draft.mode === 'advanced' || draft.audio.mode === 'studio'">
          <label
            v-for="processing in [
              'echoCancellation',
              'noiseSuppression',
              'autoGainControl',
            ] as const"
            :key="processing"
            ><input
              v-model="draft.audio[processing]"
              type="checkbox"
              :disabled="!model.capabilities?.processing.includes(processing)"
            />
            {{ processing }}
            {{
              model.capabilities?.processing.includes(processing) ? '' : '(unsupported / unknown)'
            }}</label
          >
          <label
            >Opus ceiling (bits/s)
            <input
              v-model.number="draft.audio.bitrate"
              aria-label="Opus bitrate"
              type="number"
              min="16000"
              max="256000"
          /></label>
          <label
            >Channels
            <StudySelect
              label="Channels"
              :model-value="String(draft.audio.channels)"
              :options="[
                { value: '1', label: 'Mono' },
                { value: '2', label: 'Stereo intent' },
              ]"
              @update:model-value="draft.audio.channels = Number($event) as 1 | 2"
          /></label>
          <label
            ><input v-model="draft.audio.dtx" type="checkbox" /> Discontinuous transmission</label
          >
        </template>
      </template>
      <p>
        Approximate main-layer upload ceiling:
        {{ ((draft.camera.bitrate + draft.screen.bitrate + draft.audio.bitrate) / 1e6).toFixed(2) }}
        Mbps if all sources are active;
        {{
          (
            ((draft.camera.bitrate + draft.screen.bitrate + draft.audio.bitrate) * 3600) /
            8e9
          ).toFixed(2)
        }}
        GB/hour. Layers and protocol overhead add traffic. Download varies with visible streams.
      </p>
      <button
        v-if="draft.mode === 'advanced' || section === 'Audio'"
        type="button"
        @click="applyFrom($event)"
      >
        Apply media preferences
      </button>
      <template v-if="section === 'Quality'">
        <label
          >Profile name <input v-model="name" aria-label="Profile name" maxlength="40"
        /></label>
        <button type="button" @click="model.save(name)">Save applied profile</button>
        <div v-for="saved in model.state.saved" :key="saved.name" class="quality-actions">
          <button type="button" @click="applyFrom($event, saved.quality)">
            Load {{ saved.name }}</button
          ><button type="button" @click="model.remove(saved.name)">Delete {{ saved.name }}</button>
        </div>
      </template>
    </fieldset>
    <p role="status">{{ model.state.message }}</p>
    <details v-if="section === 'Diagnostics'" open>
      <summary>Live diagnostics · requested vs actual</summary>
      <p>
        Deployment tier: {{ model.capabilities?.stage ?? 'basic' }}. Higher requests are reduced to
        this tier.
      </p>
      <p>
        Unknown values are shown as ?. Source capture settings are separate from encoded/delivered
        RTP statistics. Source display refresh and pre-capture native resolution are not exposed
        reliably.
      </p>
      <article v-for="track in tracks" :key="track.id">
        <strong>{{ track.local ? 'Sending' : 'Receiving' }} {{ track.source }}</strong>
        <p>Requested: {{ format(track.requested) }}</p>
        <p v-if="track.effective">Effective request: {{ format(track.effective) }}</p>
        <p v-if="track.capture">Source capture: {{ format(track.capture) }}</p>
        <p>Actual RTP: {{ format(track.actual) }}</p>
        <p>
          Jitter {{ track.actual.jitter ?? '?' }} s · RTT {{ track.actual.rtt ?? '?' }} s · Lost
          packets {{ track.actual.packetsLost ?? '?' }} · Dropped frames
          {{ track.actual.framesDropped ?? '?' }}
        </p>
        <p>
          Encoder limitation {{ track.actual.qualityLimitation ?? '?' }} · cumulative encode/decode
          {{ track.actual.encodeTime ?? '?' }} / {{ track.actual.decodeTime ?? '?' }} s
        </p>
        <p v-if="track.source === 'microphone'">
          Capture: {{ track.capture?.sampleRate ?? '?' }} Hz ·
          {{ track.capture?.channels ?? '?' }} channels · EC
          {{ track.capture?.echoCancellation ?? '?' }} · NS
          {{ track.capture?.noiseSuppression ?? '?' }} · AGC
          {{ track.capture?.autoGainControl ?? '?' }}
        </p>
        <p v-if="track.warning">{{ track.warning }}</p>
      </article>
    </details>
  </section>
</template>
<style scoped>
.media-quality {
  min-width: 0;
  overflow-wrap: anywhere;
}
.media-quality fieldset {
  min-width: 0;
  border: 1px solid #728887;
  border-radius: 8px;
  padding: 10px;
}
.media-quality label {
  display: grid;
  gap: 4px;
  margin: 8px 0;
}
.media-quality input,
.media-quality select {
  max-width: 100%;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}
.media-quality input[type='checkbox'] {
  width: auto;
  justify-self: start;
}
.media-quality p {
  font-size: 12px;
  line-height: 1.5;
}
.media-quality details {
  margin: 10px 0;
}
.media-quality summary {
  cursor: pointer;
  font-weight: 600;
}
.quality-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.quality-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
