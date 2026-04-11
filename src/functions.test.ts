import { describe, it, expect } from 'vitest'
import { Combatant, Condition, Visibility, colorIsDark, formatCombatantName, getHpProgressClass, getHpRatio, getHpStatus, getHpTextClass, getVisibleCombatantAtOrAfter } from './functions'

describe('Condition', () => {
  it('should use a colorblind-safe palette when enabled', () => {
    localStorage.setItem('colorBlindMode', 'true')
    const condition = new Condition('Frightened')
    expect(condition.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect([
      '#0072B2',
      '#E69F00',
      '#009E73',
      '#CC79A7',
      '#56B4E9',
      '#D55E00',
      '#F0E442',
      '#000000',
    ]).toContain(condition.color)
    localStorage.removeItem('colorBlindMode')
  })

  it('should create a condition with default value of 1', () => {
    const condition = new Condition('Frightened')
    expect(condition.name).toBe('Frightened')
    expect(condition.value).toBe(1)
  })

  it('should create a condition with custom value', () => {
    const condition = new Condition('Dying', 2)
    expect(condition.name).toBe('Dying')
    expect(condition.value).toBe(2)
  })

  it('should generate consistent colors for the same condition name', () => {
    const condition1 = new Condition('Frightened')
    const condition2 = new Condition('Frightened')
    expect(condition1.color).toBe(condition2.color)
  })

  it('should use only first word for color generation', () => {
    const condition1 = new Condition('Frightened 2')
    const condition2 = new Condition('Frightened 3')
    expect(condition1.color).toBe(condition2.color)
  })
})

describe('Combatant - HP Management', () => {
  it('should initialize with correct HP values', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    expect(combatant.currentHP).toBe(25)
    expect(combatant.totalHP).toBe(25)
    expect(combatant.tempHP).toBe(0)
    expect(combatant.maxTempHP).toBe(0)
  })

  it('should heal correctly without exceeding max HP', () => {
    const combatant = new Combatant('Fighter', 25, 10, 15)
    combatant.changeHP(5)
    expect(combatant.currentHP).toBe(20)

    combatant.changeHP(10)
    expect(combatant.currentHP).toBe(25) // capped at max
  })

  it('should damage regular HP correctly', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.changeHP(-5)
    expect(combatant.currentHP).toBe(20)

    combatant.changeHP(-25)
    expect(combatant.currentHP).toBe(0) // doesn't go below 0
  })

  it('should consume temp HP before regular HP', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.addTempHP(10)
    expect(combatant.tempHP).toBe(10)
    expect(combatant.maxTempHP).toBe(10)

    combatant.changeHP(-5)
    expect(combatant.tempHP).toBe(5)
    expect(combatant.currentHP).toBe(25) // regular HP untouched
  })

  it('should overflow damage from temp HP to regular HP', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.addTempHP(5)

    combatant.changeHP(-10)
    expect(combatant.tempHP).toBe(0)
    expect(combatant.maxTempHP).toBe(0) // reset when temp HP reaches 0
    expect(combatant.currentHP).toBe(20) // 5 absorbed by temp, 5 from regular
  })

  it('should track maximum temp HP correctly', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.addTempHP(5)
    expect(combatant.maxTempHP).toBe(5)

    combatant.addTempHP(3)
    expect(combatant.tempHP).toBe(8)
    expect(combatant.maxTempHP).toBe(8)
  })
})

describe('Combatant - Visibility', () => {
  it('should initialize with Half visibility by default', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    expect(combatant.visibility).toBe(Visibility.Half)
  })

  it('should toggle between None and Half on left click', () => {
    const combatant = new Combatant('Fighter', 25, 10, 25, [], Visibility.None)
    combatant.changeVisibility(false)
    expect(combatant.visibility).toBe(Visibility.Half)

    combatant.changeVisibility(false)
    expect(combatant.visibility).toBe(Visibility.None)
  })

  it('should set to Full on right click', () => {
    const combatant = new Combatant('Fighter', 25, 10, 25, [], Visibility.None)
    combatant.changeVisibility(true)
    expect(combatant.visibility).toBe(Visibility.Full)
  })
})

describe('Combatant - Conditions', () => {
  it('should add conditions correctly', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.newCondition('Frightened', 2)

    expect(combatant.conditions.length).toBe(1)
    expect(combatant.conditions[0].name).toBe('Frightened')
    expect(combatant.conditions[0].value).toBe(2)
  })

  it('should decrement specific condition', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.newCondition('Frightened', 2)
    const condition = combatant.conditions[0]

    combatant.changeConditionValue(condition, false)
    expect(combatant.conditions[0].value).toBe(1)
  })

  it('should increment specific condition', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.newCondition('Frightened', 1)
    const condition = combatant.conditions[0]

    combatant.changeConditionValue(condition, true)
    expect(combatant.conditions[0].value).toBe(2)
  })

  it('should remove condition when value reaches 0', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.newCondition('Frightened', 1)
    const condition = combatant.conditions[0]

    combatant.changeConditionValue(condition, false)
    expect(combatant.conditions.length).toBe(0)
  })

  it('should decrement all conditions when no specific condition provided', () => {
    const combatant = new Combatant('Fighter', 25, 10)
    combatant.newCondition('Frightened', 2)
    combatant.newCondition('Sickened', 3)

    combatant.changeConditionValue()
    expect(combatant.conditions[0].value).toBe(1)
    expect(combatant.conditions[1].value).toBe(2)
  })
})

describe('combatant naming', () => {
  it('should keep the base name when no color or count is provided', () => {
    expect(formatCombatantName('Goblin')).toBe('Goblin')
  })

  it('should include only the count when no color is selected for grouped combatants', () => {
    expect(formatCombatantName('Goblin', undefined, 3)).toBe('Goblin (3)')
  })

  it('should include only the selected color for a single combatant', () => {
    expect(formatCombatantName('Goblin', 'Green')).toBe('Goblin (Green)')
  })

  it('should include the selected color and count for grouped combatants', () => {
    expect(formatCombatantName('Goblin', 'Green', 3)).toBe('Goblin (Green 3)')
  })
})


describe('HP status helpers', () => {
  it('should calculate HP ratios safely', () => {
    expect(getHpRatio(new Combatant('Healthy', 30, 10, 20))).toBeCloseTo(2 / 3)
    expect(getHpRatio(new Combatant('Invalid', 0, 10, 0))).toBe(0)
  })

  it('should classify HP status using the shared thresholds', () => {
    expect(getHpStatus(new Combatant('Healthy', 30, 10, 25))).toBe('healthy')
    expect(getHpStatus(new Combatant('Wounded', 30, 10, 15))).toBe('wounded')
    expect(getHpStatus(new Combatant('Critical', 30, 10, 5))).toBe('critical')
  })

  it('should map HP status to text and progress classes', () => {
    const woundedCombatant = new Combatant('Wounded', 30, 10, 15)
    const criticalCombatant = new Combatant('Critical', 30, 10, 5)

    expect(getHpTextClass(woundedCombatant)).toBe('text-warning')
    expect(getHpTextClass(null)).toBe('text-base-content')
    expect(getHpProgressClass(criticalCombatant)).toBe('progress-error')
  })
})

describe('player visibility helpers', () => {
  it('should skip hidden combatants when finding the current visible combatant', () => {
    const hidden = new Combatant('Hidden', 20, 15, 20, [], Visibility.None)
    const visible = new Combatant('Visible', 20, 14, 10, [], Visibility.Half)

    expect(getVisibleCombatantAtOrAfter([hidden, visible], 0)).toBe(visible)
  })

  it('should wrap around when searching for the next visible combatant', () => {
    const visible = new Combatant('Visible', 20, 14, 10, [], Visibility.Half)
    const hidden = new Combatant('Hidden', 20, 13, 20, [], Visibility.None)

    expect(getVisibleCombatantAtOrAfter([visible, hidden], 1)).toBe(visible)
  })

  it('should return null when every combatant is hidden', () => {
    const hiddenOne = new Combatant('Hidden One', 20, 15, 20, [], Visibility.None)
    const hiddenTwo = new Combatant('Hidden Two', 20, 14, 20, [], Visibility.None)

    expect(getVisibleCombatantAtOrAfter([hiddenOne, hiddenTwo], 0)).toBeNull()
  })
})

describe('colorIsDark', () => {
  it('should detect dark colors', () => {
    expect(colorIsDark('#000000')).toBe(true)
    expect(colorIsDark('#1a1a1a')).toBe(true)
    expect(colorIsDark('000000')).toBe(true) // without # prefix
  })

  it('should detect light colors', () => {
    expect(colorIsDark('#ffffff')).toBe(false)
    expect(colorIsDark('#f0f0f0')).toBe(false)
    expect(colorIsDark('ffffff')).toBe(false) // without # prefix
  })

  it('should handle medium colors correctly', () => {
    expect(colorIsDark('#808080')).toBe(false) // gray
    expect(colorIsDark('#404040')).toBe(true) // dark gray
  })
})
