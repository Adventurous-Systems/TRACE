'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MATERIAL_CATEGORIES, CONDITION_GRADES, DECONSTRUCTION_METHODS } from '@trace/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { passports } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

// ─── Wizard steps ────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'basic', label: 'Basic info' },
  { id: 'specs', label: 'Material specs' },
  { id: 'circular', label: 'Circular data' },
  { id: 'environmental', label: 'Environmental' },
  { id: 'review', label: 'Review & submit' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

// ─── Form schema ─────────────────────────────────────────────────────────────

const WizardSchema = z.object({
  // Step 1 — Basic
  productName: z.string().min(1, 'Product name is required').max(255),
  categoryL1: z.string().min(1, 'Category is required'),
  categoryL2: z.string().optional(),
  manufacturerName: z.string().optional(),
  countryOfOrigin: z.string().length(2).optional().or(z.literal('')),
  serialNumber: z.string().optional(),

  // Step 2 — Specs
  dimensionLength: z.coerce.number().positive().optional().or(z.literal('')),
  dimensionWidth: z.coerce.number().positive().optional().or(z.literal('')),
  dimensionHeight: z.coerce.number().positive().optional().or(z.literal('')),
  dimensionWeight: z.coerce.number().positive().optional().or(z.literal('')),
  dimensionUnit: z.enum(['mm', 'cm', 'm']).default('mm'),

  // Step 3 — Circular
  conditionGrade: z.enum(['A', 'B', 'C', 'D']).optional().or(z.literal('')),
  conditionNotes: z.string().max(2000).optional(),
  deconstructionMethod: z.string().optional(),
  reclaimedBy: z.string().optional(),
  previousBuildingId: z.string().optional(),
  remainingLifeEstimate: z.coerce.number().int().nonnegative().optional().or(z.literal('')),
  handlingRequirements: z.string().optional(),

  // Step 4 — Environmental
  gwpTotal: z.coerce.number().nonnegative().optional().or(z.literal('')),
  embodiedCarbon: z.coerce.number().nonnegative().optional().or(z.literal('')),
  recycledContent: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
  carbonSavingsVsNew: z.coerce.number().nonnegative().optional().or(z.literal('')),
  epdReference: z.string().url().optional().or(z.literal('')),
  ceMarking: z.boolean().default(false),
});

type WizardForm = z.infer<typeof WizardSchema>;

const STORAGE_KEY = 'trace_register_wizard';

// ─── Component ────────────────────────────────────────────────────────────────

export default function RegisterWizard() {
  const router = useRouter();
  const [step, setStep] = useState<StepId>('basic');
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<WizardForm>({
    resolver: zodResolver(WizardSchema),
    defaultValues: {
      dimensionUnit: 'mm',
      ceMarking: false,
    },
  });

  const selectedL1 = watch('categoryL1');
  const l2Options =
    MATERIAL_CATEGORIES.find((c) => c.slug === selectedL1)?.subcategories ?? [];

  // Persist to localStorage on change
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<WizardForm>;
        Object.entries(parsed).forEach(([k, v]) => {
          setValue(k as keyof WizardForm, v as never);
        });
      } catch {
        // ignore parse errors
      }
    }
  }, [setValue]);

  const currentIndex = STEPS.findIndex((s) => s.id === step);

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getValues()));
  }

  function goNext() {
    saveProgress();
    const next = STEPS[currentIndex + 1];
    if (next) setStep(next.id);
  }

  function goPrev() {
    const prev = STEPS[currentIndex - 1];
    if (prev) setStep(prev.id);
  }

  async function onSubmit(data: WizardForm) {
    setError(null);
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const payload = {
        productName: data.productName,
        categoryL1: data.categoryL1,
        categoryL2: data.categoryL2 || undefined,
        manufacturerName: data.manufacturerName || undefined,
        countryOfOrigin: data.countryOfOrigin || undefined,
        conditionGrade: data.conditionGrade || undefined,
        conditionNotes: data.conditionNotes || undefined,
        deconstructionMethod: data.deconstructionMethod || undefined,
        reclaimedBy: data.reclaimedBy || undefined,
        previousBuildingId: data.previousBuildingId || undefined,
        remainingLifeEstimate: data.remainingLifeEstimate || undefined,
        handlingRequirements: data.handlingRequirements || undefined,
        gwpTotal: data.gwpTotal || undefined,
        embodiedCarbon: data.embodiedCarbon || undefined,
        recycledContent: data.recycledContent || undefined,
        carbonSavingsVsNew: data.carbonSavingsVsNew || undefined,
        epdReference: data.epdReference || undefined,
        ceMarking: data.ceMarking,
        dimensions:
          data.dimensionLength || data.dimensionWidth || data.dimensionHeight || data.dimensionWeight
            ? {
                length: data.dimensionLength || undefined,
                width: data.dimensionWidth || undefined,
                height: data.dimensionHeight || undefined,
                weight: data.dimensionWeight || undefined,
                unit: data.dimensionUnit,
              }
            : undefined,
      };

      const passport = await passports.create(payload, token);
      localStorage.removeItem(STORAGE_KEY);
      router.push(`/passports/${passport.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <div
              className={`w-7 h-7 rounded-full text-xs flex items-center justify-center font-medium shrink-0 ${
                i < currentIndex
                  ? 'bg-brand-600 text-white'
                  : i === currentIndex
                    ? 'border-2 border-brand-600 text-brand-600'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i < currentIndex ? '✓' : i + 1}
            </div>
            <span
              className={`text-xs hidden sm:block ${
                i === currentIndex ? 'text-brand-600 font-medium' : 'text-gray-400'
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 ${i < currentIndex ? 'bg-brand-600' : 'bg-gray-200'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Basic info */}
      {step === 'basic' && (
        <Card>
          <CardHeader>
            <CardTitle>Basic information</CardTitle>
            <CardDescription>Core identity of the material</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="productName">Product name *</Label>
              <Input
                id="productName"
                placeholder="e.g. 150mm RSJ Steel Beam"
                {...register('productName')}
              />
              {errors.productName && (
                <p className="text-sm text-red-500">{errors.productName.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="categoryL1">Category *</Label>
              <select
                id="categoryL1"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('categoryL1')}
              >
                <option value="">Select a category</option>
                {MATERIAL_CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.categoryL1 && (
                <p className="text-sm text-red-500">{errors.categoryL1.message}</p>
              )}
            </div>

            {l2Options.length > 0 && (
              <div className="space-y-1">
                <Label htmlFor="categoryL2">Subcategory</Label>
                <select
                  id="categoryL2"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register('categoryL2')}
                >
                  <option value="">Select subcategory</option>
                  {l2Options.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="manufacturerName">Manufacturer</Label>
                <Input
                  id="manufacturerName"
                  placeholder="Manufacturer name"
                  {...register('manufacturerName')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="countryOfOrigin">Country of origin (ISO)</Label>
                <Input
                  id="countryOfOrigin"
                  placeholder="GB"
                  maxLength={2}
                  className="uppercase"
                  {...register('countryOfOrigin')}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="serialNumber">Serial number</Label>
              <Input
                id="serialNumber"
                placeholder="Optional serial / batch number"
                {...register('serialNumber')}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Specs */}
      {step === 'specs' && (
        <Card>
          <CardHeader>
            <CardTitle>Material specifications</CardTitle>
            <CardDescription>Physical dimensions and technical data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Dimensions</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="dimensionLength" className="text-xs text-gray-500">
                    Length
                  </Label>
                  <Input
                    id="dimensionLength"
                    type="number"
                    placeholder="0"
                    step="any"
                    {...register('dimensionLength')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dimensionWidth" className="text-xs text-gray-500">
                    Width
                  </Label>
                  <Input
                    id="dimensionWidth"
                    type="number"
                    placeholder="0"
                    step="any"
                    {...register('dimensionWidth')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dimensionHeight" className="text-xs text-gray-500">
                    Height / Depth
                  </Label>
                  <Input
                    id="dimensionHeight"
                    type="number"
                    placeholder="0"
                    step="any"
                    {...register('dimensionHeight')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dimensionWeight" className="text-xs text-gray-500">
                    Weight (kg)
                  </Label>
                  <Input
                    id="dimensionWeight"
                    type="number"
                    placeholder="0"
                    step="any"
                    {...register('dimensionWeight')}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dimensionUnit">Unit</Label>
              <select
                id="dimensionUnit"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('dimensionUnit')}
              >
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="m">m</option>
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Circular data */}
      {step === 'circular' && (
        <Card>
          <CardHeader>
            <CardTitle>Circular economy data</CardTitle>
            <CardDescription>Condition, origin, and reuse information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="conditionGrade">Condition grade</Label>
              <select
                id="conditionGrade"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('conditionGrade')}
              >
                <option value="">Select grade</option>
                {CONDITION_GRADES.map((g) => (
                  <option key={g} value={g}>
                    Grade {g}
                    {g === 'A'
                      ? ' — Excellent'
                      : g === 'B'
                        ? ' — Good'
                        : g === 'C'
                          ? ' — Fair'
                          : ' — Poor'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="conditionNotes">Condition notes</Label>
              <textarea
                id="conditionNotes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Describe the current condition in detail..."
                {...register('conditionNotes')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="deconstructionMethod">Deconstruction method</Label>
                <select
                  id="deconstructionMethod"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register('deconstructionMethod')}
                >
                  <option value="">Select method</option>
                  {DECONSTRUCTION_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="remainingLifeEstimate">Remaining life (years)</Label>
                <Input
                  id="remainingLifeEstimate"
                  type="number"
                  placeholder="e.g. 25"
                  {...register('remainingLifeEstimate')}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="previousBuildingId">Previous building ID</Label>
                <Input
                  id="previousBuildingId"
                  placeholder="Optional building reference"
                  {...register('previousBuildingId')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="reclaimedBy">Reclaimed by</Label>
                <Input
                  id="reclaimedBy"
                  placeholder="Organisation / contractor"
                  {...register('reclaimedBy')}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="handlingRequirements">Handling requirements</Label>
              <Input
                id="handlingRequirements"
                placeholder="e.g. Crane required, fragile joints"
                {...register('handlingRequirements')}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Environmental */}
      {step === 'environmental' && (
        <Card>
          <CardHeader>
            <CardTitle>Environmental data</CardTitle>
            <CardDescription>Carbon and environmental performance metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="gwpTotal">GWP total (kgCO₂e)</Label>
                <Input
                  id="gwpTotal"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  {...register('gwpTotal')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="embodiedCarbon">Embodied carbon (kgCO₂e)</Label>
                <Input
                  id="embodiedCarbon"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  {...register('embodiedCarbon')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="recycledContent">Recycled content (%)</Label>
                <Input
                  id="recycledContent"
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  placeholder="0"
                  {...register('recycledContent')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="carbonSavingsVsNew">Carbon savings vs new (kgCO₂e)</Label>
                <Input
                  id="carbonSavingsVsNew"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  {...register('carbonSavingsVsNew')}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="epdReference">EPD reference URL</Label>
              <Input
                id="epdReference"
                type="url"
                placeholder="https://..."
                {...register('epdReference')}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="ceMarking"
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 text-brand-600"
                {...register('ceMarking')}
              />
              <Label htmlFor="ceMarking">CE marking</Label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Review */}
      {step === 'review' && (
        <Card>
          <CardHeader>
            <CardTitle>Review & submit</CardTitle>
            <CardDescription>
              Your passport will be created and queued for blockchain anchoring.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const vals = getValues();
              return (
                <dl className="divide-y text-sm">
                  {[
                    ['Product name', vals.productName],
                    ['Category', `${vals.categoryL1}${vals.categoryL2 ? ` · ${vals.categoryL2}` : ''}`],
                    ['Condition grade', vals.conditionGrade || '—'],
                    ['Manufacturer', vals.manufacturerName || '—'],
                    ['Country', vals.countryOfOrigin || '—'],
                    ['GWP total', vals.gwpTotal ? `${vals.gwpTotal} kgCO₂e` : '—'],
                    ['Carbon savings', vals.carbonSavingsVsNew ? `${vals.carbonSavingsVsNew} kgCO₂e` : '—'],
                    ['Deconstruction', vals.deconstructionMethod || '—'],
                    ['Remaining life', vals.remainingLifeEstimate ? `${vals.remainingLifeEstimate} years` : '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between py-2">
                      <dt className="text-gray-500">{label}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              );
            })()}

            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={goPrev}
          disabled={currentIndex === 0}
        >
          Back
        </Button>

        {step !== 'review' ? (
          <Button type="button" onClick={goNext} className="bg-brand-600 hover:bg-brand-700">
            Continue
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand-600 hover:bg-brand-700"
          >
            {isSubmitting ? 'Registering…' : 'Register material'}
          </Button>
        )}
      </div>
    </form>
  );
}
