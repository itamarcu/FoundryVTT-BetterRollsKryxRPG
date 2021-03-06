import { KRYX_RPG } from '../../../systems/kryx_rpg/module/config.js'
import { BetterRollsHooks } from './hooks.js'
import { CustomItemRoll, CustomRoll } from './custom-roll.js'

export function i18n (key) {
  return game.i18n.localize(key)
}

function hasProperty (object, key) {
  if (!key) return false
  let target = object
  for (let p of key.split('.')) {
    if (target.hasOwnProperty(p)) target = target[p]
    else return false
  }
  return true
}

// Checks for Maestro, allowing for cross-module compatibility
function isMaestroOn () {
  let output = false
  try {
    if (game.settings.get('maestro', 'enableItemTrack')) {
      output = true
    }
  } catch { return false }
  return output
}

// Finds if an item has a Maestro sound on it, in order to determine whether or not the dice sound should be played.
export function hasMaestroSound (item) {
  return (isMaestroOn() && item.data.flags.maestro &&
    item.data.flags.maestro.track) ? true : false
}

// Gets the IDs to send a message to
export function getWhisperData () {
  let rollMode = null,
    whisper = null,
    blind = null

  rollMode = game.settings.get('core', 'rollMode')
  if (['gmroll', 'blindroll'].includes(
    rollMode)) whisper = ChatMessage.getWhisperRecipients('GM')
  if (rollMode === 'blindroll') blind = true
  else if (rollMode === 'selfroll') whisper = [game.user._id]

  return { rollMode, whisper, blind }
}

// Returns whether an item makes an attack roll
export function isAttack (item) {
  const attacks = ['mwak', 'rwak', 'msak', 'rsak']
  return attacks.includes(item.data.data.actionType)
}

// Returns whether an item requires a saving throw
export function isSave (item) {
  return item.hasSave
}

// Returns an array with the save DC of the item. If no save is written in, one is calculated.
export function getSave (item) {
  if (!isSave(item)) return null
  return {
    dc: item.getSaveDC(),
    saveId: item.data.data.save.type,
  }
}

export function isCheck (item) {
  return item.data.type === 'tool' || typeof item.data.data?.proficient ===
    'number'
}

let kryx_rpg = KRYX_RPG

function getQuickDescriptionDefault () {
  return game.settings.get('betterrolls_kryx_rpg',
    'quickDefaultDescriptionEnabled')
}

CONFIG.BetterRollsKryxRPG = {
  validItemTypes: [
    'weapon',
    'superpower',
    'equipment',
    'feature',
    'tool',
    'consumable'],
  allFlags: {
    weaponFlags: {
      critRange: { type: 'String', value: '' },
      critDamage: { type: 'String', value: '' },
      quickDesc: {
        type: 'Boolean',
        get value () { return getQuickDescriptionDefault() },
        get altValue () { return getQuickDescriptionDefault() },
      },
      quickAttack: { type: 'Boolean', value: true, altValue: true },
      quickSave: { type: 'Boolean', value: false, altValue: false },
      quickDamage: { type: 'Array', value: [], altValue: [], context: [] },
      quickVersatile: { type: 'Boolean', value: false, altValue: false },
      quickProperties: { type: 'Boolean', value: true, altValue: true },
      quickCharges: {
        type: 'Boolean',
        value: { quantity: false, use: false, resource: false },
        altValue: { quantity: false, use: false, resource: false },
      },
      quickTemplate: { type: 'Boolean', value: true, altValue: true },
      quickOther: { type: 'Boolean', value: true, altValue: true, context: '' },
      quickFlavor: { type: 'Boolean', value: true, altValue: true },
      quickPrompt: { type: 'Boolean', value: false, altValue: false },
    },
    superpowerFlags: {
      critRange: { type: 'String', value: '' },
      critDamage: { type: 'String', value: '' },
      quickDesc: { type: 'Boolean', value: true, altValue: true },
      quickAttack: { type: 'Boolean', value: true, altValue: true },
      quickSave: { type: 'Boolean', value: true, altValue: true },
      quickDamage: { type: 'Array', value: [], altValue: [], context: [] },
      quickVersatile: { type: 'Boolean', value: false, altValue: false },
      quickProperties: { type: 'Boolean', value: true, altValue: true },
      quickCharges: {
        type: 'Boolean',
        value: { use: false, resource: false },
        altValue: { use: false, resource: false },
      },
      quickTemplate: { type: 'Boolean', value: true, altValue: true },
      quickOther: { type: 'Boolean', value: true, altValue: true, context: '' },
      quickFlavor: { type: 'Boolean', value: false, altValue: false },
      quickPrompt: { type: 'Boolean', value: false, altValue: false },
    },
    equipmentFlags: {
      critRange: { type: 'String', value: '' },
      critDamage: { type: 'String', value: '' },
      quickDesc: { type: 'Boolean', value: true, altValue: true },
      quickAttack: { type: 'Boolean', value: true, altValue: true },
      quickSave: { type: 'Boolean', value: true, altValue: true },
      quickDamage: { type: 'Array', value: [], altValue: [], context: [] },
      quickProperties: { type: 'Boolean', value: true, altValue: true },
      quickCharges: {
        type: 'Boolean',
        value: { quantity: false, use: false, resource: false },
        altValue: { quantity: false, use: false, resource: false },
      },
      quickOther: { type: 'Boolean', value: true, altValue: true, context: '' },
      quickFlavor: { type: 'Boolean', value: true, altValue: true },
      quickPrompt: { type: 'Boolean', value: false, altValue: false },
    },
    featureFlags: {
      critRange: { type: 'String', value: '' },
      critDamage: { type: 'String', value: '' },
      quickDesc: { type: 'Boolean', value: true, altValue: true },
      quickAttack: { type: 'Boolean', value: true, altValue: true },
      quickSave: { type: 'Boolean', value: true, altValue: true },
      quickDamage: { type: 'Array', value: [], altValue: [], context: [] },
      quickProperties: { type: 'Boolean', value: true, altValue: true },
      quickCharges: {
        type: 'Boolean',
        value: { use: false, resource: false, charge: false },
        altValue: { use: false, resource: false, charge: false },
      },
      quickTemplate: { type: 'Boolean', value: false, altValue: false },
      quickOther: { type: 'Boolean', value: true, altValue: true, context: '' },
      quickFlavor: { type: 'Boolean', value: true, altValue: true },
      quickPrompt: { type: 'Boolean', value: false, altValue: false },
    },
    toolFlags: {
      critRange: { type: 'String', value: '' },
      quickDesc: {
        type: 'Boolean',
        get value () { return getQuickDescriptionDefault() },
        get altValue () { return getQuickDescriptionDefault() },
      },
      quickCheck: { type: 'Boolean', value: true, altValue: true },
      quickProperties: { type: 'Boolean', value: true, altValue: true },
      quickFlavor: { type: 'Boolean', value: true, altValue: true },
      quickPrompt: { type: 'Boolean', value: false, altValue: false },
    },
    consumableFlags: {
      critRange: { type: 'String', value: '' },
      critDamage: { type: 'String', value: '' },
      quickDesc: { type: 'Boolean', value: true, altValue: true },
      quickAttack: { type: 'Boolean', value: true, altValue: true },
      quickSave: { type: 'Boolean', value: true, altValue: true },
      quickDamage: { type: 'Array', value: [], altValue: [], context: [] },
      quickProperties: { type: 'Boolean', value: true, altValue: true },
      quickCharges: {
        type: 'Boolean',
        value: { quantity: false, use: false, resource: false },
        altValue: { quantity: false, use: false, resource: false },
      },
      quickTemplate: { type: 'Boolean', value: false, altValue: false },
      quickOther: { type: 'Boolean', value: true, altValue: true, context: '' },
      quickFlavor: { type: 'Boolean', value: true, altValue: true },
      quickPrompt: { type: 'Boolean', value: false, altValue: false },
    },
  },
}

Hooks.on(`ready`, () => {
  // Make a combined damage type array that includes healing
  CONFIG.BetterRollsKryxRPG.combinedDamageTypes = kryx_rpg.damageTypes

  // Updates crit text from the dropdown.
  let critText = game.settings.get('betterrolls_kryx_rpg', 'critString')
  if (critText.includes('brkr.critString')) {
    critText = i18n(critText)
    game.settings.set('betterrolls_kryx_rpg', 'critString', critText)
  }
})

// Create flags for item when it's first created
Hooks.on(`createOwnedItem`, (actor, itemData) => {
  game.settings.get('betterrolls_kryx_rpg', 'diceEnabled') ? redUpdateFlags(
    game.actors.get(actor._id).items.get(itemData._id)) : null
})

Hooks.on(`renderChatMessage`, (message, html, data) => {
  updateSaveButtons(html)
})

/**
 * Adds buttons and assign their functionality to the sheet
 * @param {String} triggeringElement - this is the html selector string that opens the description - mostly optional for different sheetclasses
 * @param {String} buttonContainer - this is the html selector string to which the buttons will be prepended - mostly optional for different sheetclasses
 */
export async function addItemSheetButtons (
  actor, html, data, triggeringElement = '', buttonContainer = '') {
  // Do not modify the sheet if the user does not have permission to use the sheet
  if (actor.permission < 3) { return }

  // Setting default element selectors
  if (triggeringElement === '') triggeringElement = '.item .item-name h4'
  if (buttonContainer === '') buttonContainer = '.item-properties'

  // adding an event for when the description is shown
  html.find(triggeringElement).click(event => {
    let li = $(event.currentTarget).parents('.item')
    addButtonsToItemLi(li, actor, buttonContainer)
  })

  for (let element of html.find(triggeringElement)) {
    let li = $(element).parents('.item')
    addButtonsToItemLi(li, actor, buttonContainer)
  }
}

async function addButtonsToItemLi (li, actor, buttonContainer) {

  let item = actor.getOwnedItem(String(li.attr('data-item-id')))
  let itemData = item.data.data
  let flags = item.data.flags.BetterRollsKryxRPG

  // Check settings
  let diceEnabled = game.settings.get('betterrolls_kryx_rpg', 'diceEnabled')

  if (!li.hasClass('expanded')) return  // this is a way to not continue if the items description is not shown, but its only a minor gain to do this while it may break this module in sheets that dont use "expanded"

  // Create the buttons
  let buttons = $(`<div class="item-buttons"></div>`)
  let buttonsWereAdded = false
  let contextEnabled = (game.settings.get('betterrolls_kryx_rpg',
    'damageContextPlacement') !== '0') ? true : false
  switch (item.data.type) {
    case 'weapon':
    case 'feature':
    case 'superpower':
    case 'consumable':
      buttonsWereAdded = true
      if (diceEnabled) buttons.append(
        `<span class="tag"><button data-action="quickRoll">${i18n(
          'brkr.buttons.roll')}</button></span>`)
      if (diceEnabled) buttons.append(
        `<span class="tag"><button data-action="altRoll">${i18n(
          'brkr.buttons.altRoll')}</button></span>`)
      if (isAttack(item)) buttons.append(
        `<span class="tag"><button data-action="attackRoll">${i18n(
          'brkr.buttons.attack')}</button></span>`)
      if (isSave(item)) {
        let saveData = getSave(item)
        buttons.append(`<span class="tag"><button data-action="save">${i18n(
          'brkr.buttons.saveDC')} ${saveData.dc} ${kryx_rpg.saves[saveData.saveId]}</button></span>`)
      }
      if (itemData.damage.parts.length > 0) {
        buttons.append(
          `<span class="tag"><button data-action="damageRoll" data-value="all">${i18n(
            'brkr.buttons.damage')}</button></span>`)
        if (itemData.damage.versatile) {
          buttons.append(
            `<span class="tag"><button data-action="verDamageRoll" data-value="all">${i18n(
              'brkr.buttons.verDamage')}</button></span>`)
        }
        // Make a damage button for each damage type
        if (itemData.damage.parts.length > 1) {
          buttons.append(`<br>`)
          for (let i = 0; i < itemData.damage.parts.length; i++) {
            let damageString = (contextEnabled &&
              flags.quickDamage.context[i]) ||
              CONFIG.BetterRollsKryxRPG.combinedDamageTypes[itemData.damage.parts[i][1]]
            buttons.append(
              `<span class="tag"><button data-action="damageRoll" data-value=${i}>${i}: ${damageString}</button></span>`)
            if (i === 0 && itemData.damage.versatile) {
              buttons.append(
                `<span class="tag"><button data-action="verDamageRoll" data-value=0>${0}: ${damageString} (${kryx_rpg.weaponProperties.ver})</button></span>`)
            }
          }
        }
      }
      if (itemData.formula.length > 0) {
        let otherString = contextEnabled && flags.quickOther.context
        if (!otherString) { otherString = 'brkr.settings.otherFormula' }
        buttons.append(
          `<span class="tag"><button data-action="otherFormulaRoll">${otherString}</button></span>`)
      }
      break
    case 'tool':
      buttonsWereAdded = true
      buttons.append(
        `<span class="tag"><button data-action="toolCheck" data-ability="${itemData.ability.value}">${i18n(
          'brkr.buttons.itemUse')} ${item.name}</button></span>`)
      if (itemData.formula && itemData.formula.length > 0) {
        let otherString = contextEnabled && flags.quickOther.context
        if (!otherString) { otherString = 'brkr.settings.otherFormula' }
        buttons.append(
          `<span class="tag"><button data-action="otherFormulaRoll">${otherString}</button></span>`)
      }
      break
  }

  if (buttonsWereAdded) { buttons.append(`<br>`) }

  // Add info button
  if (diceEnabled) {
    buttons.append(`<span class="tag"><button data-action="infoRoll">${i18n(
      'brkr.buttons.info')}</button></span>`)
  }

  // Add default roll button
  buttons.append(`<span class="tag"><button data-action="vanillaRoll">${i18n(
    'brkr.buttons.defaultSheetRoll')}</button></span>`)

  //if (((item.data.data.damage !== undefined) && item.data.data.damage.value) || ((item.data.data.damage2 !== undefined) && item.data.data.damage2.value) || (chatData.isAttack) || (chatData.isSave) || (chatData.hasCharges)) {buttonsWereAdded = true;}
  if (buttonsWereAdded) {
    buttons.append(`<br><header style="margin-top:6px"></header>`)
  }

  // adding the buttons to the sheet

  let targetHTML = li //$(event.target.parentNode.parentNode)
  targetHTML.find(buttonContainer).prepend(buttons)

  //html.find(buttonContainer).prepend(buttons);

  // adding click event for all buttons
  buttons.find('button').click((ev) => {
    ev.preventDefault()
    ev.stopPropagation()

    // which function gets called depends on the type of button stored in the dataset attribute action
    // If better rolls are on
    if (diceEnabled) {
      // The arguments compounded into an object and an array of fields, to be served to the roll() function as the params and fields arguments
      let params = { forceCrit: ev.altKey, event: ev }
      let fields = []
      if (params.forceCrit) {
        fields.push([
          'flavor',
          {
            text: `${game.settings.get('betterrolls_kryx_rpg', 'critString')}`,
          }])
      }

      // Sets the damage roll in the argument to the value of the button
      function setDamage (versatile = false) {
        let damage = []
        if (ev.target.dataset.value === 'all') {
          fields.push(['damage', { index: 'all', versatile: versatile }])
        } else {
          fields.push(['damage', { index: Number(ev.target.dataset.value) }])
        }
      }

      switch (ev.target.dataset.action) {
        case 'quickRoll':
          params.preset = 0
          break
        case 'altRoll':
          params.preset = 1
          break
        case 'attackRoll':
          fields.push(['attack'])
          break
        case 'save':
          fields.push(['savedc'])
          break
        case 'damageRoll':
          setDamage()
          break
        case 'verDamageRoll':
          setDamage(true)
          params.versatile = true
          break
        case 'toolCheck':
          fields.push(['toolcheck'])
          break
        case 'otherFormulaRoll':
          fields.push(['other'])
          break
        case 'infoRoll':
          fields.push(['desc'])
          params.properties = true
          break
        case 'vanillaRoll':
          item.actor.sheet._onItemRoll(event)
          break
      }

      if (ev.target.dataset.action !== 'vanillaRoll') {
        new CustomItemRoll(item, params, fields).toMessage()
      }
      // If better rolls are off
    } else {
      switch (ev.target.dataset.action) {
        case 'weaponAttack':
          item.rollWeaponAttack(ev)
          break
        case 'weaponDamage':
          item.rollWeaponDamage(ev)
          break
        case 'weaponDamage2':
          item.rollWeaponDamage(ev, true)
          break
        case 'spellAttack':
          item.rollSpellAttack(ev)
          break
        case 'spellDamage':
          item.rollSpellDamage(ev)
          break
        case 'featureAttack':
          item.rollFeatAttack(ev)
          break
        case 'featureDamage':
          item.rollFeatDamage(ev)
          break
        case 'consume':
          item.rollConsumable(ev)
          break
        case 'toolCheck':
          item.rollToolCheck(ev)
          break
        case 'infoRoll':
          BetterRollsDice.fullRoll(item, { info: true, properties: true })
          break
      }
    }
  })
}

export async function redUpdateFlags (item) {
  if (!item.data || CONFIG.BetterRollsKryxRPG.validItemTypes.indexOf(item.data.type) === -1) { return }
  if (item.data.flags.BetterRollsKryxRPG === undefined) {
    item.data.flags.BetterRollsKryxRPG = {}
  }

  let flags = duplicate(CONFIG.BetterRollsKryxRPG.allFlags[item.data.type.concat('Flags')])
  item.data.flags.BetterRollsKryxRPG = mergeObject(flags,
    item.data.flags.BetterRollsKryxRPG)

  // If quickDamage flags should exist, update them based on which damage formulae are available
  if (CONFIG.BetterRollsKryxRPG.allFlags[item.data.type.concat('Flags')].quickDamage) {
    let newQuickDamageValues = []
    let newQuickDamageAltValues = []

    // Make quickDamage flags if they don't exist
    if (!item.data.flags.BetterRollsKryxRPG.quickDamage) {
      item.data.flags.BetterRollsKryxRPG.quickDamage = {
        type: 'Array',
        value: [],
        altValue: [],
      }
    }

    for (let i = 0; i < item.data.data.damage.parts.length; i++) {
      newQuickDamageValues[i] = true
      newQuickDamageAltValues[i] = true
      if (item.data.flags.BetterRollsKryxRPG.quickDamage.value[i] != null) {
        newQuickDamageValues[i] = item.data.flags.BetterRollsKryxRPG.quickDamage.value[i]
      }
      if (item.data.flags.BetterRollsKryxRPG.quickDamage.altValue[i] != null) {
        newQuickDamageAltValues[i] = item.data.flags.BetterRollsKryxRPG.quickDamage.altValue[i]
      }
    }
    item.data.flags.BetterRollsKryxRPG.quickDamage.value = newQuickDamageValues
    item.data.flags.BetterRollsKryxRPG.quickDamage.altValue = newQuickDamageAltValues
  }

  return item.data.flags.BetterRollsKryxRPG
}

export function updateSaveButtons (html) {
  html.find('.card-buttons').off()
  html.find('.card-buttons button').off().click(async event => {
    const button = event.currentTarget
    if (button.dataset.action === 'save') {
      event.preventDefault()
      let actors = getTargetActors()
      let saveId = button.dataset.save
      let params = await CustomRoll.eventToAdvantage(event)
      for (let i = 0; i < actors.length; i++) {
        if (actors[i]) {
          CustomRoll.fullRollAttribute(actors[i], saveId, 'save', params)
        }
      }
      setTimeout(() => {button.disabled = false}, 1)
    }
  })
}

export function getTargetActors () {
  const character = game.user.character
  const controlled = canvas.tokens.controlled

  if (controlled.length === 0) return [character] || null
  if (controlled.length > 0) {
    const actors = controlled.map(character => character.actor)
    return actors
  } else throw new Error(
    `You must designate a specific Token as the roll target`)
}

// Gets the total of all damage rolls from a given Better Roll HTML
export function getTotalDamage (html) {
  return
}

/**
 * Replaces the sheet's d20 rolls for ability checks, skill checks, and saving throws into dual d20s.
 * Also replaces the default button on items with a "standard" roll.
 */
export function changeRollsToDual (actor, html, data, params) {

  if (actor && actor.permission < 3) { return }

  let paramRequests = mergeObject({
    abilityButton: '.ability-name',
    saveButton: '.save-name',
    skillButton: '.skill-name',
    itemButton: '.item .item-image',
    singleAbilityButton: true,
  }, params || {})

  // Assign new action to ability check button
  let abilityName = html.find(paramRequests.abilityButton)
  if (abilityName.length > 0 && paramRequests.singleAbilityButton === true) {
    abilityName.off()
    abilityName.click(async event => {
      event.preventDefault()
      let ability = event.currentTarget.parentElement.getAttribute(
        'data-ability')
      params = await CustomRoll.eventToAdvantage(event)
      CustomRoll.fullRollAttribute(actor, ability, 'check', params)
    })
  }

  // Assign new action to save buttons
  let saveName = html.find(paramRequests.saveButton)
  if (saveName.length > 0) {
    saveName.off()
    saveName.click(async event => {
      event.preventDefault()
      let save = event.currentTarget.parentElement.getAttribute('data-save')
      params = await CustomRoll.eventToAdvantage(event)
      CustomRoll.fullRollAttribute(actor, save, 'save', params)
    })
  }

  // Assign new action to skill button
  let skillName = html.find(paramRequests.skillButton)
  if (skillName.length > 0) {
    skillName.off()
    skillName.click(async event => {
      event.preventDefault()
      let params = await CustomRoll.eventToAdvantage(event)
      let skill = event.currentTarget.parentElement.getAttribute('data-skill')
      CustomRoll.fullRollSkill(actor, skill, params)
    })
  }

  // Assign new action to item image button
  let itemImage = html.find(paramRequests.itemButton)
  if (itemImage.length > 0) {
    itemImage.off()
    itemImage.click(async event => {
      let li = $(event.currentTarget).parents('.item'),
        actorID = actor.id,
        itemID = String(li.attr('data-item-id')),
        item = actor.getOwnedItem(itemID),
        params = await CustomRoll.eventToAdvantage(event)

      // Case 1 - If the image button should roll an "Item Macro" macro
      if (window.ItemMacro?.hasMacro(item)) {
        event.preventDefault()
        window.ItemMacro.runMacro(actorID, itemID)

        // Case 2 - If the image button should roll a vanilla roll
      } else if (!game.settings.get('betterrolls_kryx_rpg',
        'imageButtonEnabled')) {
        item.actor.sheet._onItemRoll(event)

        // Case 3 - If Alt is pressed
      } else if (event.altKey) {
        if (game.settings.get('betterrolls_kryx_rpg', 'altSecondaryEnabled')) {
          event.preventDefault()
          CustomRoll.newItemRoll(item, mergeObject(params, { preset: 1 })).
            toMessage()
        } else {
          item.actor.sheet._onItemRoll(event)
        }
        // Case 4 - If Alt is not pressed
      } else {
        event.preventDefault()
        CustomRoll.newItemRoll(item, mergeObject(params, { preset: 0 })).
          toMessage()
      }
    })
  }
}

// Creates message out of a Custom Roll. Rolls the necessary 3D dice using the custom roll data, only rendering the message when the roll is finished.
export async function createMessage (customRoll) {
  if (game.dice3d && customRoll.dicePool) {
    let wd = getWhisperData()
    game.dice3d.showForRoll(customRoll.dicePool, game.user, true, wd.whisper,
      wd.blind || false).
      then(async () => {
        let output = await ChatMessage.create(customRoll.chatData)
        return output
      })
  } else {
    let output = await ChatMessage.create(customRoll.chatData)
    return output
  }
}

// Frontend for macros
export function BetterRolls () {
  async function assignMacro (item, slot, mode) {
    function command () {
      switch (mode) {
        case 'name':
          return `BetterRolls.quickRoll("${item.name}");`
        case 'id':
          return `BetterRolls.quickRollById("${item.actorId}", "${item.data._id}");`
        case 'vanillaRoll':
          return `BetterRolls.vanillaRoll("${item.actorId}", "${item.data._id}");`
      }
    }

    let macro = game.macros.entities.find(
      m => (m.name === item.name) && (m.command === command))
    if (!macro) {
      macro = await Macro.create({
        name: item.data.name,
        type: 'script',
        img: item.data.img,
        command: command(),
        flags: { 'kryx_rpg.itemMacro': true },
      }, { displaySheet: false })
    }
    game.user.assignHotbarMacro(macro, slot)
  }

  // Performs a vanilla roll message, searching the actor and item by ID.
  function vanillaRoll (actorId, itemId) {
    let actor = getActorById(actorId)
    if (!actor) {
      return ui.notifications.warn(`${i18n('brkr.error.noActorWithId')}`)
    }
    let item = actor.getOwnedItem(itemId)
    if (!item) {
      return ui.notifications.warn(`${i18n('brkr.error.noItemWithId')}`)
    }
    if (actor.permission != 3) {
      return ui.notifications.warn(`${i18n('brkr.error.noActorPermission')}`)
    }
    item.roll()
  }

  // Performs a Quick Roll, searching for an item in the controlled actor by name.
  function quickRoll (itemName) {
    let speaker = ChatMessage.getSpeaker()
    let actor = getActorById(speaker.actor)
    let item = actor ? actor.items.find(i => i.name === itemName) : null
    if (!actor) {
      return ui.notifications.warn(`${i18n('brkr.error.noSelectedActor')}`)
    } else if (!item) {
      return ui.notifications.warn(
        `${actor.name} ${i18n('brkr.error.noKnownItemOnActor')} ${itemName}`)
    }
    new CustomItemRoll(item,
      { event: event, preset: (isAlt(event) ? 1 : 0) }).toMessage()
  }

  // Performs a Quick Roll, searching the actor and item by ID.
  function quickRollById (actorId, itemId) {
    let actor = getActorById(actorId)
    if (!actor) {
      return ui.notifications.warn(`${i18n('brkr.error.noActorWithId')}`)
    }
    let item = actor.getOwnedItem(itemId)
    if (!item) {
      return ui.notifications.warn(`${i18n('brkr.error.noItemWithId')}`)
    }
    if (actor.permission != 3) {
      return ui.notifications.warn(`${i18n('brkr.error.noActorPermission')}`)
    }
    new CustomItemRoll(item,
      { event: event, preset: (isAlt(event) ? 1 : 0) }).toMessage()
  }

  // Performs a Quick Roll, searching the actor and item by name.
  function quickRollByName (actorName, itemName) {
    let actor = getActorByName(actorName)
    if (!actor) {
      return ui.notifications.warn(
        `${i18n('brkr.error.noKnownActorWithName')}`)
    }
    let item = actor.items.find(i => i.name === itemName)
    if (!item) {
      return ui.notifications.warn(
        `${actor.name} ${i18n('brkr.error.noKnownItemOnActor')} ${itemName}`)
    }
    if (actor.permission != 3) {
      return ui.notifications.warn(`${i18n('brkr.error.noActorPermission')}`)
    }
    new CustomItemRoll(item,
      { event: event, preset: (isAlt(event) ? 1 : 0) }).toMessage()
  }

  // Returns if an event should have its corresponding Quick Roll be an Alt Roll.
  function isAlt (event) {
    if (event && event.altKey && game.settings.get('betterrolls_kryx_rpg',
      'altSecondaryEnabled')) { return true } else { return false }
  }

  // Prefer synthetic actors over game.actors to avoid consumables and mana being missdepleted.
  function getActorById (actorId) {
    let actor = canvas.tokens.placeables.find(
      t => t.actor?._id === actorId)?.actor
    if (!actor) actor = game.actors.entities.find(a => a._id === actorId)
    return actor
  }

  // Prefer token actors over game.actors to avoid consumables and mana being missdepleted.
  function getActorByName (actorName) {
    let actor = canvas.tokens.placeables.find(
      p => p.data.name === actorName)?.actor
    if (!actor) actor = game.actors.entities.find(e => e.name === actorName)
    return actor
  }

  Hooks._hooks.hotbarDrop = [
    (bar, data, slot) => {
      if (data.type !== 'Item') return true
      if (event && event.altKey) { // not using isAlt(event) because it's not related to alternative roll
        assignMacro(data, slot, 'vanillaRoll')
      } else {
        assignMacro(data, slot, 'id')
      }
      return false
    }].concat(Hooks._hooks.hotbarDrop || [])

  return {
    assignMacro: assignMacro,
    vanillaRoll: vanillaRoll,
    quickRoll: quickRoll,
    quickRollById: quickRollById,
    quickRollByName: quickRollByName,
    addItemContent: BetterRollsHooks.addItemContent,
    hooks: BetterRollsHooks,
    rollCheck: CustomRoll.rollCheck,
    rollSave: CustomRoll.rollSave,
    rollAbilityCheck: CustomRoll.rollAbilityCheck,
    rollSavingThrow: CustomRoll.rollAbilitySave,
    rollSkill: CustomRoll.fullRollSkill,
    rollItem: CustomRoll.newItemRoll,
  }
}

Hooks.on(`ready`, () => {
  window.BetterRolls = BetterRolls()
  Hooks.call('readyBetterRolls')
})