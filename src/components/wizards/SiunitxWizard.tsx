import React, { useState } from "react";
import {
  Stack,
  Tabs,
  TextInput,
  Select,
  NumberInput,
  Switch,
  Group,
  Text,
  Divider,
  Button,
  Code,
  ActionIcon,
  ScrollArea,
  Box,
  Textarea,
  SegmentedControl,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHashtag,
  faRulerCombined,
  faWeightHanging,
  faCog,
  faCopy,
  faCheck,
  faList,
  faBolt,
} from "@fortawesome/free-solid-svg-icons";

interface SiunitxWizardProps {
  onInsert: (code: string) => void;
}

// --- DATA: UNITS & PREFIXES ---

const UNIT_PREFIXES = [
  { value: "", label: "None" },
  { value: "\\quecto", label: "quecto (10^-30)" },
  { value: "\\ronto", label: "ronto (10^-27)" },
  { value: "\\yocto", label: "yocto (10^-24)" },
  { value: "\\zepto", label: "zepto (10^-21)" },
  { value: "\\atto", label: "atto (10^-18)" },
  { value: "\\femto", label: "femto (10^-15)" },
  { value: "\\pico", label: "pico (10^-12)" },
  { value: "\\nano", label: "nano (10^-9)" },
  { value: "\\micro", label: "micro (10^-6)" },
  { value: "\\milli", label: "milli (10^-3)" },
  { value: "\\centi", label: "centi (10^-2)" },
  { value: "\\deci", label: "deci (10^-1)" },
  { value: "\\deca", label: "deca (10^1)" },
  { value: "\\hecto", label: "hecto (10^2)" },
  { value: "\\kilo", label: "kilo (10^3)" },
  { value: "\\mega", label: "mega (10^6)" },
  { value: "\\giga", label: "giga (10^9)" },
  { value: "\\tera", label: "tera (10^12)" },
  { value: "\\peta", label: "peta (10^15)" },
  { value: "\\exa", label: "exa (10^18)" },
  { value: "\\zetta", label: "zetta (10^21)" },
  { value: "\\yotta", label: "yotta (10^24)" },
  { value: "\\ronna", label: "ronna (10^27)" },
  { value: "\\quetta", label: "quetta (10^30)" },
];

const COMMON_UNITS = [
  {
    group: "SI Base",
    items: [
      { value: "\\meter", label: "meter (Length)" },
      { value: "\\gram", label: "gram (Mass)" },
      { value: "\\second", label: "second (Time)" },
      { value: "\\ampere", label: "ampere (Current)" },
      { value: "\\kelvin", label: "kelvin (Temperature)" },
      { value: "\\mole", label: "mole (Amount)" },
      { value: "\\candela", label: "candela (Luminous)" },
    ],
  },
  {
    group: "Common Derived",
    items: [
      { value: "\\hertz", label: "hertz (Frequency)" },
      { value: "\\newton", label: "newton (Force)" },
      { value: "\\pascal", label: "pascal (Pressure)" },
      { value: "\\joule", label: "joule (Energy)" },
      { value: "\\watt", label: "watt (Power)" },
      { value: "\\coulomb", label: "coulomb (Charge)" },
      { value: "\\volt", label: "volt (Potential)" },
      { value: "\\ohm", label: "ohm (Resistance)" },
      { value: "\\degreeCelsius", label: "degree Celsius)" },
    ],
  },
  {
    group: "Non-SI",
    items: [
      { value: "\\liter", label: "liter" },
      { value: "\\degree", label: "degree (Angle)" },
      { value: "\\arcminute", label: "arcminute" },
      { value: "\\arcsecond", label: "arcsecond" },
      { value: "\\percent", label: "percent" },
    ],
  },
];

const COMMON_UNITS_FLAT = COMMON_UNITS.filter((g) => g && g.items).flatMap(
  (g) => g.items.map((i) => ({ value: i.value, label: i.label })),
);

const QUANTITY_PRESETS = [
  {
    group: "Kinematics",
    items: [
      {
        label: "Velocity (m/s)",
        value: "velocity",
        units: [
          { unit: "\\meter", prefix: "", power: "", per: false },
          { unit: "\\second", prefix: "", power: "", per: true },
        ],
      },
      {
        label: "Acceleration (m/s²)",
        value: "acceleration",
        units: [
          { unit: "\\meter", prefix: "", power: "", per: false },
          { unit: "\\second", prefix: "", power: "\\squared", per: true },
        ],
      },
    ],
  },
  {
    group: "Dynamics",
    items: [
      {
        label: "Force (N)",
        value: "force",
        units: [{ unit: "\\newton", prefix: "", power: "", per: false }],
      },
      {
        label: "Energy (J)",
        value: "energy",
        units: [{ unit: "\\joule", prefix: "", power: "", per: false }],
      },
      {
        label: "Power (W)",
        value: "power",
        units: [{ unit: "\\watt", prefix: "", power: "", per: false }],
      },
      {
        label: "Pressure (Pa)",
        value: "pressure",
        units: [{ unit: "\\pascal", prefix: "", power: "", per: false }],
      },
    ],
  },
  {
    group: "Electromagnetism",
    items: [
      {
        label: "Charge (C)",
        value: "charge",
        units: [{ unit: "\\coulomb", prefix: "", power: "", per: false }],
      },
      {
        label: "Current (A)",
        value: "current",
        units: [{ unit: "\\ampere", prefix: "", power: "", per: false }],
      },
      {
        label: "Voltage (V)",
        value: "voltage",
        units: [{ unit: "\\volt", prefix: "", power: "", per: false }],
      },
      {
        label: "Resistance (Ω)",
        value: "resistance",
        units: [{ unit: "\\ohm", prefix: "", power: "", per: false }],
      },
      {
        label: "Frequency (Hz)",
        value: "frequency",
        units: [{ unit: "\\hertz", prefix: "", power: "", per: false }],
      },
    ],
  },
  {
    group: "Other",
    items: [
      {
        label: "Area (m²)",
        value: "area",
        units: [
          { unit: "\\meter", prefix: "", power: "\\squared", per: false },
        ],
      },
      {
        label: "Volume (m³)",
        value: "volume",
        units: [{ unit: "\\meter", prefix: "", power: "\\cubed", per: false }],
      },
      {
        label: "Density (kg/m³)",
        value: "density",
        units: [
          { unit: "\\gram", prefix: "\\kilo", power: "", per: false },
          { unit: "\\meter", prefix: "", power: "\\cubed", per: true },
        ],
      },
    ],
  },
];

const QUANTITY_PRESETS_FLAT = QUANTITY_PRESETS.filter(
  (g) => g && g.items,
).flatMap((g) => g.items.map((i) => ({ value: i.value, label: i.label })));

// --- SUB-COMPONENTS ---

const NumberConfig = ({
  value,
  onChange,
  showValueInput = true,
}: {
  value: any;
  onChange: (val: any) => void;
  showValueInput?: boolean;
}) => {
  return (
    <Stack gap="xs">
      {showValueInput && (
        <TextInput
          label="Number Value"
          placeholder="e.g. 1234.567"
          value={value.number}
          onChange={(e) =>
            onChange({ ...value, number: e.currentTarget.value })
          }
        />
      )}

      <Group grow align="flex-start">
        <Select
          label="Exponent Mode"
          data={[
            { value: "input", label: "As Input" },
            { value: "scientific", label: "Scientific" },
            { value: "engineering", label: "Engineering" },
            { value: "fixed", label: "Fixed Point" },
          ]}
          value={value.expMode}
          onChange={(v) => onChange({ ...value, expMode: v })}
        />
        <Select
          label="Round Mode"
          data={[
            { value: "none", label: "None" },
            { value: "places", label: "Decimal Places" },
            { value: "figures", label: "Significant Figures" },
            { value: "uncertainty", label: "Uncertainty" },
          ]}
          value={value.roundMode}
          onChange={(v) => onChange({ ...value, roundMode: v })}
        />
      </Group>

      {(value.roundMode === "places" || value.roundMode === "figures") && (
        <NumberInput
          label={
            value.roundMode === "places"
              ? "Decimal Places"
              : "Significant Figures"
          }
          value={value.roundPrecision}
          onChange={(v) => onChange({ ...value, roundPrecision: Number(v) })}
          min={0}
          max={20}
        />
      )}
    </Stack>
  );
};

// Simple active unit state to build complex units
interface ActiveUnit {
  id: string;
  prefix: string;
  unit: string;
  power: string; // "", "\squared", "\cubed", "^{n}"
  per: boolean;
}

const UnitBuilder = ({
  units,
  setUnits,
}: {
  units: ActiveUnit[];
  setUnits: (u: ActiveUnit[]) => void;
}) => {
  const addUnit = () => {
    setUnits([
      ...units,
      {
        id: Date.now().toString(),
        prefix: "",
        unit: "\\meter",
        power: "",
        per: false,
      },
    ]);
  };

  const updateUnit = (id: string, field: keyof ActiveUnit, val: any) => {
    setUnits(units.map((u) => (u.id === id ? { ...u, [field]: val } : u)));
  };

  const removeUnit = (id: string) => {
    setUnits(units.filter((u) => u.id !== id));
  };

  const handlePresetChange = (val: string | null) => {
    if (!val) return;
    // Find preset
    for (const group of QUANTITY_PRESETS) {
      const preset = group.items.find((i) => i.value === val);
      if (preset) {
        // Map preset units to ActiveUnit
        const newUnits = preset.units.map((u, i) => ({
          id: Date.now().toString() + i,
          prefix: u.prefix,
          unit: u.unit,
          power: u.power,
          per: u.per,
        }));
        setUnits(newUnits);
        break;
      }
    }
  };

  return (
    <Stack gap="xs">
      <Select
        label="Physical Quantity (Preset)"
        placeholder="Search (e.g. Velocity, Force)..."
        data={QUANTITY_PRESETS_FLAT}
        leftSection={<FontAwesomeIcon icon={faBolt} style={{ width: 14 }} />}
        searchable
        clearable
        onChange={handlePresetChange}
        mb="xs"
      />
      <Divider />
      <Text size="sm" fw={500}>
        Unit Composition
      </Text>
      {units.map((u, index) => (
        <Group key={u.id} align="flex-end" gap="xs">
          <Select
            label={index === 0 ? "Prefix" : undefined}
            data={UNIT_PREFIXES}
            value={u.prefix}
            onChange={(v) => updateUnit(u.id, "prefix", v)}
            style={{ width: 90 }}
            searchable
          />
          <Select
            label={index === 0 ? "Unit" : undefined}
            data={COMMON_UNITS_FLAT}
            value={u.unit}
            onChange={(v) => updateUnit(u.id, "unit", v)}
            style={{ flex: 1 }}
            searchable
          />
          <Select
            label={index === 0 ? "Power" : undefined}
            data={[
              { value: "", label: "1" },
              { value: "\\squared", label: "^2" },
              { value: "\\cubed", label: "^3" },
              { value: "^{4}", label: "^4" },
              { value: "^{-1}", label: "^-1" },
            ]}
            value={u.power}
            onChange={(v) => updateUnit(u.id, "power", v)}
            style={{ width: 80 }}
          />
          {index > 0 && (
            <Switch
              label="Per (/)"
              checked={u.per}
              onChange={(e) => updateUnit(u.id, "per", e.currentTarget.checked)}
              className="mt-2"
            />
          )}
          <ActionIcon
            color="red"
            variant="subtle"
            onClick={() => removeUnit(u.id)}
            mb={4}
            disabled={units.length === 1}
          >
            <Text size="xl">×</Text>
          </ActionIcon>
        </Group>
      ))}
      <Button variant="default" size="xs" onClick={addUnit} fullWidth>
        Add Unit Component
      </Button>
    </Stack>
  );
};

// --- LISTS & RANGES COMPONENT ---
interface ListRangeState {
  mode: "list" | "range";
  listContent: string;
  rangeStart: string;
  rangeEnd: string;
}

const ListRangeConfig = ({
  state,
  onChange,
}: {
  state: ListRangeState;
  onChange: (s: ListRangeState) => void;
}) => {
  return (
    <Stack gap="md">
      <SegmentedControl
        value={state.mode}
        onChange={(v) => onChange({ ...state, mode: v as "list" | "range" })}
        data={[
          { label: "List of Numbers", value: "list" },
          { label: "Range of Numbers", value: "range" },
        ]}
      />

      {state.mode === "list" ? (
        <Textarea
          label="Numbers List"
          description="Separate numbers with semicolons (;)"
          placeholder="10; 20; 5.5; 100"
          value={state.listContent}
          onChange={(e) =>
            onChange({ ...state, listContent: e.currentTarget.value })
          }
          minRows={3}
        />
      ) : (
        <Group grow>
          <TextInput
            label="Start Value"
            value={state.rangeStart}
            onChange={(e) =>
              onChange({ ...state, rangeStart: e.currentTarget.value })
            }
          />
          <TextInput
            label="End Value"
            value={state.rangeEnd}
            onChange={(e) =>
              onChange({ ...state, rangeEnd: e.currentTarget.value })
            }
          />
        </Group>
      )}
    </Stack>
  );
};

// --- MAIN WIZARD COMPONENT ---

export const SiunitxWizard: React.FC<SiunitxWizardProps> = ({ onInsert }) => {
  const [activeTab, setActiveTab] = useState<string>("qty");

  // State
  const [numState, setNumState] = useState({
    number: "10.5",
    expMode: "input",
    roundMode: "none",
    roundPrecision: 2,
  });

  const [unitState, setUnitState] = useState<ActiveUnit[]>([
    { id: "1", prefix: "\\kilo", unit: "\\meter", power: "", per: false },
  ]);

  const [listRangeState, setListRangeState] = useState<ListRangeState>({
    mode: "range",
    listContent: "10; 20; 30",
    rangeStart: "5",
    rangeEnd: "10",
  });

  // Options State
  const [options, setOptions] = useState({
    perMode: "power", // power, fraction, symbol
    interUnit: "thin", // thin, tight, cdot
    rangePhrase: "to", // to, --
  });

  // Code Generation
  const generateOptionsIds = (nState: typeof numState) => {
    const opts = [];
    if (nState.expMode === "scientific") opts.push("exponent-mode=scientific");
    if (nState.expMode === "engineering")
      opts.push("exponent-mode=engineering");
    if (nState.expMode === "fixed") opts.push("exponent-mode=fixed");

    if (nState.roundMode === "places")
      opts.push(`round-mode=places, round-precision=${nState.roundPrecision}`);
    if (nState.roundMode === "figures")
      opts.push(`round-mode=figures, round-precision=${nState.roundPrecision}`);
    if (nState.roundMode === "uncertainty") opts.push(`round-mode=uncertainty`);

    return opts;
  };

  const generateUnitCode = (uList: ActiveUnit[]) => {
    let code = "";
    uList.forEach((u) => {
      if (u.per) code += "\\per";
      code += u.prefix + u.unit + u.power;
    });
    return code;
  };

  const getPreview = () => {
    let opts = generateOptionsIds(numState);
    const optsStr = opts.length > 0 ? `[${opts.join(", ")}]` : "";
    const unitsStr = generateUnitCode(unitState);

    if (activeTab === "num") {
      return `\\num${optsStr}{${numState.number}}`;
    } else if (activeTab === "unit") {
      return `\\unit{${unitsStr}}`;
    } else if (activeTab === "qty") {
      return `\\qty${optsStr}{${numState.number}}{${unitsStr}}`;
    } else if (activeTab === "list-range") {
      if (listRangeState.mode === "list") {
        const listClean = listRangeState.listContent
          .split(";")
          .map((s) => s.trim())
          .join(";");
        return `\\qtylist${optsStr}{${listClean}}{${unitsStr}}`;
      } else {
        return `\\qtyrange${optsStr}{${listRangeState.rangeStart}}{${listRangeState.rangeEnd}}{${unitsStr}}`;
      }
    } else if (activeTab === "options") {
      return `\\sisetup{\n  per-mode=${options.perMode},\n  inter-unit-product=\\ensuremath{{${options.interUnit === "cdot" ? "\\cdot" : "\\,"}}},\n  range-phrase={ ${options.rangePhrase === "to" ? "to" : "--"} }\n}`;
    }
    return "";
  };

  const code = getPreview();

  return (
    <Stack h="100%" gap={0}>
      <Tabs
        value={activeTab}
        onChange={(v) => setActiveTab(v || "qty")}
        variant="outline"
      >
        <Tabs.List>
          <Tabs.Tab
            value="qty"
            leftSection={<FontAwesomeIcon icon={faWeightHanging} />}
          >
            Quantity
          </Tabs.Tab>
          <Tabs.Tab
            value="list-range"
            leftSection={<FontAwesomeIcon icon={faList} />}
          >
            Lists/Ranges
          </Tabs.Tab>
          <Tabs.Tab
            value="num"
            leftSection={<FontAwesomeIcon icon={faHashtag} />}
          >
            Num
          </Tabs.Tab>
          <Tabs.Tab
            value="unit"
            leftSection={<FontAwesomeIcon icon={faRulerCombined} />}
          >
            Unit
          </Tabs.Tab>
          <Tabs.Tab
            value="options"
            leftSection={<FontAwesomeIcon icon={faCog} />}
          >
            Setup
          </Tabs.Tab>
        </Tabs.List>

        <ScrollArea h="400" type="auto" offsetScrollbars>
          <Box p="md">
            {activeTab === "qty" && (
              <Stack>
                <Divider label="Number" labelPosition="left" />
                <NumberConfig value={numState} onChange={setNumState} />
                <Divider label="Unit" labelPosition="left" mt="sm" />
                <UnitBuilder units={unitState} setUnits={setUnitState} />
              </Stack>
            )}

            {activeTab === "list-range" && (
              <Stack>
                <ListRangeConfig
                  state={listRangeState}
                  onChange={setListRangeState}
                />
                <Divider
                  label="Unit & Formatting"
                  labelPosition="left"
                  mt="sm"
                />
                <UnitBuilder units={unitState} setUnits={setUnitState} />
                <Divider />
                <NumberConfig
                  value={numState}
                  onChange={setNumState}
                  showValueInput={false}
                />
              </Stack>
            )}

            {activeTab === "num" && (
              <NumberConfig value={numState} onChange={setNumState} />
            )}

            {activeTab === "unit" && (
              <UnitBuilder units={unitState} setUnits={setUnitState} />
            )}

            {activeTab === "options" && (
              <Stack>
                <Select
                  label="Per Mode (fractions vs powers)"
                  data={["power", "fraction", "symbol"]}
                  value={options.perMode}
                  onChange={(v) =>
                    setOptions({ ...options, perMode: v || "power" })
                  }
                />
                <Select
                  label="Inter-unit Product"
                  data={["thin", "tight", "cdot"]}
                  value={options.interUnit}
                  onChange={(v) =>
                    setOptions({ ...options, interUnit: v || "thin" })
                  }
                />
                <Select
                  label="Range Phrase"
                  data={[
                    { value: "to", label: "text 'to'" },
                    { value: "--", label: "dashed '--'" },
                  ]}
                  value={options.rangePhrase}
                  onChange={(v) =>
                    setOptions({ ...options, rangePhrase: v || "to" })
                  }
                />
                <Text size="sm" c="dimmed">
                  Generates \sisetup for preamble.
                </Text>
              </Stack>
            )}
          </Box>
        </ScrollArea>
      </Tabs>

      <Box
        p="md"
        style={{
          borderTop: "1px solid var(--mantine-color-default-border)",
          backgroundColor: "var(--app-color-gray-0)",
        }}
      >
        <Group justify="space-between" mb={4}>
          <Text size="xs" fw={700} c="dimmed">
            GENERATED CODE
          </Text>
          <ActionIcon
            size="xs"
            variant="subtle"
            onClick={() => navigator.clipboard.writeText(code)}
          >
            <FontAwesomeIcon icon={faCopy} />
          </ActionIcon>
        </Group>
        <Code block mb="md">
          {code}
        </Code>
        <Button
          fullWidth
          leftSection={<FontAwesomeIcon icon={faCheck} />}
          onClick={() => onInsert(code)}
        >
          Insert
        </Button>
      </Box>
    </Stack>
  );
};
