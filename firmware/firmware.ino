/*
 * 4-Channel Finger Load Cell Firmware
 * Arduino UNO + 4× HX711
 *
 * Pin mapping:
 *   CH1 (Index)  — DOUT 2, SCK 6
 *   CH2 (Middle) — DOUT 3, SCK 7
 *   CH3 (Ring)   — DOUT 4, SCK 8
 *   CH4 (Pinky)  — DOUT 5, SCK 9
 *
 * Serial protocol (115200 baud):
 *   Output: ms,kg1,kg2,kg3,kg4\n  (fresh frames, up to ~80 Hz)
 *   Commands:
 *     t            — tare all channels
 *     c <ch> <kg>  — calibrate channel (1-4) with known mass
 *     p            — print calibration info
 *
 * Hardware note:
 *   To reach ~80 Hz on CURRENT_UNO_HX711, all HX711 boards must be
 *   physically configured for 80 SPS. Firmware alone cannot force 80 SPS.
 */

#include <HX711.h>
#include <EEPROM.h>

#define NUM_CH 4
#define BAUD 115200
#define EEPROM_VER 0xA1
#define EEPROM_ADDR 0     // version(1) + 4 floats(16) = 17 bytes

// Pin assignments: {DOUT, SCK}
static const uint8_t PINS[NUM_CH][2] = {
  {2, 6}, {3, 7}, {4, 8}, {5, 9}
};

HX711 scale[NUM_CH];

long   offset_counts[NUM_CH];  // runtime tare offsets
float  kg_per_count[NUM_CH];   // persistent calibration factors
float  last_kg[NUM_CH];        // fallback values
long   last_raw_counts[NUM_CH];
long   last_delta_counts[NUM_CH];
bool   has_raw_sample[NUM_CH];

static const float DEFAULT_KG_PER_COUNT = 0.0f;
static bool output_raw_mode = true; // true=raw counts, false=kg

// ── Sampling helpers ────────────────────────────────────────────

bool allChannelsReady() {
  for (int i = 0; i < NUM_CH; i++) {
    if (!scale[i].is_ready()) return false;
  }
  return true;
}

bool readChannelRawWithTimeout(int idx, long &raw_out, unsigned long timeout_ms) {
  unsigned long t0 = millis();
  while ((millis() - t0) < timeout_ms) {
    if (scale[idx].is_ready()) {
      raw_out = scale[idx].read();
      last_raw_counts[idx] = raw_out;
      last_delta_counts[idx] = raw_out - offset_counts[idx];
      has_raw_sample[idx] = true;
      return true;
    }
    delay(1);
  }
  return false;
}

void readFreshFrame() {
  for (int i = 0; i < NUM_CH; i++) {
    long raw = scale[i].read();
    last_raw_counts[i] = raw;
    last_delta_counts[i] = raw - offset_counts[i];
    has_raw_sample[i] = true;
  }
}

void updateOutputFrame() {
  for (int i = 0; i < NUM_CH; i++) {
    long delta = last_raw_counts[i] - offset_counts[i];
    last_delta_counts[i] = delta;
    if (output_raw_mode) {
      last_kg[i] = (float)delta;
    } else {
      last_kg[i] = (float)delta * kg_per_count[i];
    }
  }
}

void streamFrame(unsigned long t_ms) {
  Serial.print(t_ms);
  for (int i = 0; i < NUM_CH; i++) {
    Serial.print(',');
    Serial.print(last_kg[i], 3);
  }
  Serial.println();
}

// ── EEPROM helpers ──────────────────────────────────────────────

void loadCalibration() {
  if (EEPROM.read(EEPROM_ADDR) != EEPROM_VER) {
    for (int i = 0; i < NUM_CH; i++) kg_per_count[i] = DEFAULT_KG_PER_COUNT;
    return;
  }
  for (int i = 0; i < NUM_CH; i++) {
    EEPROM.get(EEPROM_ADDR + 1 + i * sizeof(float), kg_per_count[i]);
    // sanity: reject NaN / inf / zero
    if (isnan(kg_per_count[i]) || isinf(kg_per_count[i])) {
      kg_per_count[i] = DEFAULT_KG_PER_COUNT;
    }
  }
}

void saveCalibration() {
  EEPROM.update(EEPROM_ADDR, EEPROM_VER);
  for (int i = 0; i < NUM_CH; i++) {
    EEPROM.put(EEPROM_ADDR + 1 + i * sizeof(float), kg_per_count[i]);
  }
}

// ── Command handling ────────────────────────────────────────────

void handleSerial() {
  if (!Serial.available()) return;

  String line = Serial.readStringUntil('\n');
  line.trim();
  if (line.length() == 0) return;

  char cmd = line.charAt(0);

  if (cmd == 't') {
    // Tare: capture current raw as offset for all channels
    for (int i = 0; i < NUM_CH; i++) {
      long raw = 0;
      if (readChannelRawWithTimeout(i, raw, 120)) {
        offset_counts[i] = raw;
      } else if (has_raw_sample[i]) {
        offset_counts[i] = last_raw_counts[i];
        Serial.print("# warn: ch");
        Serial.print(i + 1);
        Serial.println(" not ready, used last sample for tare");
      } else {
        Serial.print("# warn: ch");
        Serial.print(i + 1);
        Serial.println(" not ready, tare unchanged");
      }
    }
    Serial.println("# tare ok");

  } else if (cmd == 'c') {
    // Calibrate: c <ch 1-4> <known_kg>
    String args = line.substring(1);
    args.trim();
    int split = args.indexOf(' ');
    if (split < 0) {
      Serial.println("# err: usage: c <ch 1-4> <kg>");
      return;
    }

    String ch_str = args.substring(0, split);
    String kg_str = args.substring(split + 1);
    ch_str.trim();
    kg_str.trim();
    kg_str.replace(',', '.');  // tolerate locale decimal comma

    int ch = ch_str.toInt();
    float known_kg = kg_str.toFloat();

    if (ch < 1 || ch > 4) {
      Serial.println("# err: ch must be 1-4");
      return;
    }
    int idx = ch - 1;
    long raw = 0;
    if (!readChannelRawWithTimeout(idx, raw, 250)) {
      if (has_raw_sample[idx]) {
        raw = last_raw_counts[idx];
        Serial.println("# warn: channel not ready, using last sample");
      } else {
        Serial.println("# err: channel not ready");
        return;
      }
    }
    long delta = raw - offset_counts[idx];
    if (abs(delta) < 100) {
      Serial.println("# err: delta too small, add load first");
      return;
    }
    if (known_kg == 0.0f) {
      Serial.println("# err: known_kg must be nonzero");
      return;
    }
    kg_per_count[idx] = known_kg / (float)delta;
    saveCalibration();
    Serial.print("# cal ch");
    Serial.print(ch);
    Serial.print(" factor=");
    Serial.println(kg_per_count[idx], 10);

  } else if (cmd == 'p') {
    // Print calibration debug info including live raw count
    Serial.print("# mode=");
    Serial.println(output_raw_mode ? "raw" : "kg");
    for (int i = 0; i < NUM_CH; i++) {
      Serial.print("# ch");
      Serial.print(i + 1);
      Serial.print(" offset=");
      Serial.print(offset_counts[i]);
      Serial.print(" kg_per_count=");
      Serial.print(kg_per_count[i], 10);
      Serial.print(" last_kg=");
      Serial.print(last_kg[i], 4);
      if (scale[i].is_ready()) {
        long raw = scale[i].read();
        last_raw_counts[i] = raw;
        last_delta_counts[i] = raw - offset_counts[i];
        has_raw_sample[i] = true;
        Serial.print(" raw=");
        Serial.print(raw);
        Serial.print(" fresh=1");
      } else if (has_raw_sample[i]) {
        Serial.print(" raw=");
        Serial.print(last_raw_counts[i]);
        Serial.print(" fresh=0");
      } else {
        Serial.print(" raw=NO_SAMPLE");
      }
      Serial.print(" delta=");
      Serial.print(last_delta_counts[i]);
      Serial.println();
    }

  } else if (cmd == 'm') {
    // Mode control: m raw | m kg
    if (line.endsWith("raw")) {
      output_raw_mode = true;
      Serial.println("# mode raw");
    } else if (line.endsWith("kg")) {
      output_raw_mode = false;
      Serial.println("# mode kg");
    } else {
      Serial.print("# mode=");
      Serial.println(output_raw_mode ? "raw" : "kg");
      Serial.println("# usage: m raw|kg");
    }
  }
}

// ── Setup & Loop ────────────────────────────────────────────────

void setup() {
  Serial.begin(BAUD);

  for (int i = 0; i < NUM_CH; i++) {
    scale[i].begin(PINS[i][0], PINS[i][1]);
    offset_counts[i] = 0;
    last_kg[i] = 0.0f;
    last_raw_counts[i] = 0;
    last_delta_counts[i] = 0;
    has_raw_sample[i] = false;
  }

  loadCalibration();
  Serial.println("# boot ok");
  Serial.println("# mode raw");
}

void loop() {
  handleSerial();

  // Emit one frame only when every channel has a fresh conversion ready.
  if (!allChannelsReady()) return;

  unsigned long t0 = millis();
  readFreshFrame();
  updateOutputFrame();
  streamFrame(t0);
}
