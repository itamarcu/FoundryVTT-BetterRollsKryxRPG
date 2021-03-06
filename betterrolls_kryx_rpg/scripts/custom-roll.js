import {
  createMessage,
  getSave,
  getWhisperData,
  hasMaestroSound,
  i18n,
  isAttack,
  isCheck,
  isSave,
  redUpdateFlags,
} from './betterrolls_kryx_rpg.js'
import { Utils } from './utils.js'

import { KRYX_RPG } from '../../../systems/kryx_rpg/module/config.js'

let kryx_rpg = KRYX_RPG
let DEBUG = false

const blankRoll = new Roll('0').roll() // Used for CHAT_MESSAGE_TYPES.ROLL, which requires a roll that Better Rolls otherwise does not need

function debug () {
  if (DEBUG) {
    console.log.apply(console, arguments)
  }
}

// General class for macro support, actor rolls, and most static rolls.
export class CustomRoll {
  /**
   * A function for rolling multiple rolls. Returns the html code to inject into the chat message.
   * @param {Integer} numRolls      The number of rolls to put in the template.
   * @param {String} dice        The dice formula.
   * @param {Array} parts        The array of additional parts to add to the dice formula.
   * @param {Object} data        The actor's data to use as reference
   * @param {String} title        The roll's title.
   * @param {Boolean} critThreshold  The minimum roll on the dice to cause a critical roll.
   * @param {String} rollState      null, "highest", or "lowest"
   * @param {Boolean} triggersCrit    Whether this field marks the entire roll as critical
   * @param {String} rollType      The type of roll, such as "attack" or "damage"
   */
  static async rollMultiple (
    numRolls = 1, dice = '1d20', parts = [], data = {}, title = '',
    critThreshold, rollState, triggersCrit = false, rollType = '') {
    let formula = [dice].concat(parts)
    let rolls = []
    let tooltips = []

    // Step 1 - Get all rolls
    for (let i = 0; i < numRolls; i++) {
      rolls.push(await new Roll(formula.join('+'), data).roll())
      tooltips.push(await rolls[i].getTooltip())
    }

    let chatFormula = rolls[0].formula

    // Step 2 - Setup chatData
    let chatData = {
      title: title,
      formula: chatFormula,
      tooltips: tooltips,
      rolls: rolls,
      rollState: rollState,
      rollType: rollType,
    }

    function tagIgnored () {
      let rollTotals = rolls.map(r => r.total)
      let chosenResult = rollTotals[0]
      if (rollState) {
        if (rollState == 'highest') {
          chosenResult = rollTotals.sort(
            function (a, b) {return a - b})[rollTotals.length - 1]
        } else if (rollState == 'lowest') {
          chosenResult = rollTotals.sort(function (a, b) {return a - b})[0]
        }

        rolls.forEach(r => {
          if (r.total != chosenResult) { r.ignored = true }
        })
      }
    }

    switch (rollState) {
      case 'highest':
        break
      case 'lowest':
        break
    }

    tagIgnored()

    // Step 3 - Create HTML using custom template
    let multiRoll = await renderTemplate(
      'modules/betterrolls_kryx_rpg/templates/red-multiroll.html', chatData)

    let template = CustomItemRoll.tagCrits(multiRoll, rolls,
      '.dice-total.dice-row-item', critThreshold, [20])
    template.isCrit = template.isCrit && triggersCrit

    let output = {
      html: template.html,
      isCrit: template.isCrit,
      data: chatData,
    }
    return output
  }

  static getRollState (args) {
    let adv = args.adv || 0
    let disadv = args.disadv || 0
    if (adv > 0 || disadv > 0) {
      if (adv > disadv) { return 'highest' } else if (adv <
        disadv) { return 'lowest' }
    } else { return null }
  }

  // Gets the dice pool from a single template. Used for non-item rolls.
  static getDicePool (template) {
    let dicePool = new Roll('0').roll()
    template.data.rolls.forEach(roll => {
      roll.dice.forEach(die => {
        dicePool._dice.push(die)
      })
    })
    return dicePool
  }

  /**
   * for KryxRPG:  when holding Alt, there will be a "triple" field
   */
  static async eventToAdvantage (ev, itemType) {
    const obj = await this._eventToAdvantage(ev, itemType)
    obj.triple = ev.altKey ? 1 : 0
    return obj
  }

  // Returns an {adv, disadv} object when given an event
  static async _eventToAdvantage (ev, itemType) {
    if (ev.shiftKey) {
      return { adv: 1, disadv: 0 }
    } else if ((keyboard.isCtrl(ev))) {
      return { adv: 0, disadv: 1 }
    } else if (game.settings.get('betterrolls_kryx_rpg',
      'queryAdvantageEnabled')) {
      // Don't show dialog for items that aren't tool or weapon.
      if (itemType != null && !itemType.match(/^(tool|weapon)$/)) {
        return { adv: 0, disadv: 0 }
      }
      return new Promise(resolve => {
        new Dialog({
          title: i18n('brkr.querying.title'),
          buttons: {
            disadvantage: {
              label: i18n('brkr.querying.disadvantage'),
              callback: () => resolve({ adv: 0, disadv: 1 }),
            },
            normal: {
              label: i18n('brkr.querying.normal'),
              callback: () => resolve({ adv: 0, disadv: 0 }),
            },
            advantage: {
              label: i18n('brkr.querying.advantage'),
              callback: () => resolve({ adv: 1, disadv: 0 }),
            },
          },
        }).render(true)
      })
    } else {
      return { adv: 0, disadv: 0 }
    }
  }

  // Creates a chat message with the requested skill check.
  static async fullRollSkill (actor, skill, params) {
    let skl = actor.data.data.skills[skill],
      label = kryx_rpg.skills[skill]

    let wd = getWhisperData()

    let multiRoll = await CustomRoll.rollSkillCheck(actor, skl, params)

    // let titleImage = (actor.data.img == "icons/svg/mystery-man.svg") ? actor.data.token.img : actor.data.img;
    let titleImage = CustomRoll.getImage(actor)

    let titleTemplate = await renderTemplate(
      'modules/betterrolls_kryx_rpg/templates/red-header.html', {
        item: {
          img: titleImage,
          name: `${i18n(label)}`,
        },
      })

    let content = await renderTemplate(
      'modules/betterrolls_kryx_rpg/templates/red-fullroll.html', {
        title: titleTemplate,
        templates: [multiRoll],
      })

    let has3DDiceSound = game.dice3d ? game.settings.get('dice-so-nice',
      'settings').enabled : false
    let playRollSounds = game.settings.get('betterrolls_kryx_rpg',
      'playRollSounds')

    let output = {
      chatData: {
        user: game.user._id,
        content: content,
        speaker: {
          actor: actor._id,
          token: actor.token,
          alias: actor.token?.name || actor.name,
        },
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        roll: blankRoll,
        rollMode: wd.rollMode,
        blind: wd.blind,
        sound: (playRollSounds && !has3DDiceSound) ? CONFIG.sounds.dice : null,
      },
      dicePool: CustomRoll.getDicePool(multiRoll),
    }

    if (wd.whisper) { output.chatData.whisper = wd.whisper }

    // Output the rolls to chat
    return await createMessage(output)
  }

  // Rolls a skill check through a character
  static async rollSkillCheck (actor, skill, params = {}) {
    let parts = ['@value'],
      data = { value: skill.total },
      flavor = null

    const skillBonus = getProperty(actor, 'data.data.bonuses.abilities.skill')
    if (skillBonus) {
      parts.push('@skillBonus')
      data['skillBonus'] = skillBonus
    }

    // Halfling Luck check
    let d20String = '1d20'
    if (Utils.isHalfling(actor)) {
      d20String = '1d20r<2'
    }

    if (getProperty(actor, 'data.flags.kryx_rpg.reliableTalent') &&
      skill.value >= 1) {
      d20String = `{${d20String},10}kh`
    }

    let rollState = params ? CustomRoll.getRollState(params) : null

    let numRolls = game.settings.get('betterrolls_kryx_rpg', 'd20Mode')
    if (rollState && numRolls == 1) {
      numRolls = 2
    }
    if (params.triple) {
      numRolls = 3
    }

    return await CustomRoll.rollMultiple(numRolls, d20String, parts, data,
      flavor, params.critThreshold || null, rollState, params.triggersCrit,
      'skill')
  }

  static async rollCheck (actor, ability, params) {
    return await CustomRoll.fullRollCheck(actor, ability, params)
  }

  static async rollSave (actor, saveId, params) {
    return await CustomRoll.fullRollSave(actor, saveId, params)
  }

  static getImage (actor) {
    let actorImage = (actor.data.img && actor.data.img != DEFAULT_TOKEN &&
      !actor.data.img.includes('*')) ? actor.data.img : false
    let tokenImage = actor.token?.data?.img
      ? actor.token.data.img
      : actor.data.token.img

    switch (game.settings.get('betterrolls_kryx_rpg', 'defaultRollArt')) {
      case 'actor':
        return actorImage || tokenImage
        break
      case 'token':
        return tokenImage || actorImage
        break
    }
  }

  /**
   * Creates a chat message with the requested ability check or saving throw.
   * @param {ActorKryx} actor    The actor object to reference for the roll.
   * @param {String} abilityOrSaveId    you know, that thing
   * @param {String} rollType    String of either "check" or "save"
   */
  static async fullRollAttribute (actor, abilityOrSaveId, rollType, params) {
    let multiRoll,
      titleString,
      label

    let wd = getWhisperData()

    if (rollType === 'check') {
      multiRoll = await CustomRoll.rollAbilityCheck(actor, abilityOrSaveId,
        params)
      label = kryx_rpg.abilities[abilityOrSaveId]
      titleString = `${i18n(label)} ${i18n('brkr.chat.check')}`
    } else if (rollType === 'save') {
      multiRoll = await CustomRoll.rollSavingThrow(actor, abilityOrSaveId,
        params)
      label = kryx_rpg.saves[abilityOrSaveId]
      titleString = `${i18n(label)} ${i18n('brkr.chat.save')}`
    }

    // let titleImage = ((actor.data.img == DEFAULT_TOKEN) || actor.data.img == "" || actor.data.img.includes("*")) ? (actor.token && actor.token.data ? actor.token.data.img : actor.data.token.img) : actor.data.img;
    let titleImage = CustomRoll.getImage(actor)

    let titleTemplate = await renderTemplate(
      'modules/betterrolls_kryx_rpg/templates/red-header.html', {
        item: {
          img: titleImage,
          name: titleString,
        },
      })

    let content = await renderTemplate(
      'modules/betterrolls_kryx_rpg/templates/red-fullroll.html', {
        title: titleTemplate,
        templates: [multiRoll],
      })

    let has3DDiceSound = game.dice3d ? game.settings.get('dice-so-nice',
      'settings').enabled : false
    let playRollSounds = game.settings.get('betterrolls_kryx_rpg',
      'playRollSounds')

    let rollMessage = {
      chatData: {
        user: game.user._id,
        content: content,
        speaker: {
          actor: actor._id,
          token: actor.token,
          alias: actor.token?.name || actor.name,
        },
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        roll: blankRoll,
        rollMode: wd.rollMode,
        blind: wd.blind,
        sound: (playRollSounds && !has3DDiceSound) ? CONFIG.sounds.dice : null,
      },
      dicePool: CustomRoll.getDicePool(multiRoll),
    }

    if (wd.whisper) { rollMessage.chatData.whisper = wd.whisper }

    // Output the rolls to chat
    return await createMessage(rollMessage)
  }

  static async rollAbilityCheck (actor, abl, params = {}) {
    let parts = ['@value'],
      data = duplicate(actor.data.data),
      flavor = null

    data.value = data.abilities[abl].value

    const checkBonus = getProperty(actor, 'data.data.bonuses.abilityCheck')
    const secondCheckBonus = getProperty(actor,
      'data.data.bonuses.abilities.check')

    if (checkBonus && parseInt(checkBonus) !== 0) {
      parts.push('@checkBonus')
      data['checkBonus'] = checkBonus
    } else if (secondCheckBonus && parseInt(secondCheckBonus) !== 0) {
      parts.push('@secondCheckBonus')
      data['secondCheckBonus'] = secondCheckBonus
    }

    if (actor.getFlag('kryx_rpg', 'jackOfAllTrades')) {
      parts.push(`floor(@attributes.prof / 2)`)
    }

    // Halfling Luck check
    let d20String = '1d20'
    if (Utils.isHalfling(actor)) {
      d20String = '1d20r<2'
    }

    let rollState = params ? CustomRoll.getRollState(params) : null

    let numRolls = game.settings.get('betterrolls_kryx_rpg', 'd20Mode')
    if (rollState && numRolls == 1) {
      numRolls = 2
    }
    if (params.triple) {
      numRolls = 3
    }

    return await CustomRoll.rollMultiple(numRolls, d20String, parts, data,
      flavor, params.critThreshold || null, rollState)
  }

  static async rollSavingThrow (actor, save, params = {}) {
    let actorData = actor.data.data
    let parts = []
    let data = { value: [] }
    let flavor = null

    // Support modifiers and global save bonus
    const saveBonus = getProperty(actorData, 'bonuses.saves.save') || null
    let saveData = actor.data.data.saves[save]
    let saveParts = {}
    saveParts.value = saveData.value !== 0 ? saveData.value.toString() : null
    saveParts.prof = ((saveData.prof || 0) *
      actorData.attributes.prof).toString()
    let mods = [saveParts.value, saveParts.prof, saveBonus]
    for (let i = 0; i < mods.length; i++) {
      if (mods[i] && mods[i] !== '0') {
        data.value.push(mods[i])
      }
    }
    data.value = data.value.join('+')

    // Halfling Luck check
    let d20String = '1d20'
    if (Utils.isHalfling(actor)) {
      d20String = '1d20r<2'
    }

    if (data.value !== '') {
      parts.push('@value')
    }

    let rollState = params ? CustomRoll.getRollState(params) : null

    let numRolls = game.settings.get('betterrolls_kryx_rpg', 'd20Mode')
    if (rollState && numRolls == 1) {
      numRolls = 2
    }
    if (params.triple) {
      numRolls = 3
    }

    return await CustomRoll.rollMultiple(numRolls, d20String, parts, data,
      flavor, params.critThreshold || null, rollState)
  }

  static newItemRoll (item, params, fields) {
    let roll = new CustomItemRoll(item, params, fields)
    return roll
  }
}

let defaultParams = {
  title: '',
  forceCrit: false,
  preset: false,
  properties: true,
  spentCost: null,
  useCharge: {},
  useTemplate: false,
  event: null,
  adv: 0,
  disadv: 0,
  triple: 0,
}

// A custom roll with data corresponding to an item on a character's sheet.
export class CustomItemRoll {
  constructor (item, params, fields) {
    this.item = item
    this.actor = item.actor
    this.itemFlags = item.data.flags
    this.params = mergeObject(duplicate(defaultParams), params || {})	// General parameters for the roll as a whole.
    this.fields = fields			 									// Where requested roll fields are stored, in the order they should be rendered.
    this.templates = []			 									// Where finished templates are stored, in the order they should be rendered.

    this.rolled = false
    this.isCrit = this.params.forceCrit || false			// Defaults to false, becomes "true" when a valid attack or check first crits.
    this.rollState = null

    if (!this.params.event) { this.params.event = event }

    this.checkEvent()
    this.setRollState()
    this.updateConfig()
    this.dicePool = new Roll('0').roll()
  }

  // Update config settings in the roll.
  updateConfig () {
    this.config = {
      playRollSounds: game.settings.get('betterrolls_kryx_rpg',
        'playRollSounds'),
      hasMaestroSound: hasMaestroSound(this.item),
      damageRollPlacement: game.settings.get('betterrolls_kryx_rpg',
        'damageRollPlacement'),
      rollTitlePlacement: game.settings.get('betterrolls_kryx_rpg',
        'rollTitlePlacement'),
      damageTitlePlacement: game.settings.get('betterrolls_kryx_rpg',
        'damageTitlePlacement'),
      damageContextPlacement: game.settings.get('betterrolls_kryx_rpg',
        'damageContextPlacement'),
      contextReplacesTitle: game.settings.get('betterrolls_kryx_rpg',
        'contextReplacesTitle'),
      contextReplacesDamage: game.settings.get('betterrolls_kryx_rpg',
        'contextReplacesDamage'),
      critString: game.settings.get('betterrolls_kryx_rpg', 'critString'),
      critBehavior: game.settings.get('betterrolls_kryx_rpg', 'critBehavior'),
      quickDefaultDescriptionEnabled: game.settings.get('betterrolls_kryx_rpg',
        'quickDefaultDescriptionEnabled'),
      altSecondaryEnabled: game.settings.get('betterrolls_kryx_rpg',
        'altSecondaryEnabled'),
      d20Mode: game.settings.get('betterrolls_kryx_rpg', 'd20Mode'),
      hideDC: game.settings.get('betterrolls_kryx_rpg', 'hideDC'),
    }
  }

  checkEvent (ev) {
    let eventToCheck = ev || this.params.event
    if (!eventToCheck) { return }
    if (eventToCheck.shiftKey) {
      this.params.adv = 1
    }
    if (keyboard.isCtrl(eventToCheck)) {
      this.params.disadv = 1
    }
    if (eventToCheck.altKey) {
      this.params.triple = 1
    }
  }

  // Sets the roll's rollState to "highest" or "lowest" if the roll has advantage or disadvantage, respectively.
  setRollState () {
    this.rollState = null
    let adv = this.params.adv
    let disadv = this.params.disadv
    if (adv > 0 || disadv > 0) {
      if (adv > disadv) { this.rollState = 'highest' } else if (adv <
        disadv) { this.rollState = 'lowest' }
    }
  }

  // Adds a roll's results to the custom roll's dice pool, for the purposes of 3D dice rendering.
  addToDicePool (roll) {
    roll?.dice?.forEach(die => {
      this.dicePool._dice.push(die)
    })
  }

  async roll () {
    let params = this.params,
      item = this.item,
      itemData = item.data.data,
      actor = item.actor

    await redUpdateFlags(item)

    Hooks.call('preRollItemBetterRolls', this)

    if (Number.isInteger(params.preset)) {
      this.updateForPreset()
    }

    if (params.useCharge.resource) {
      const consume = itemData.consume
      if (consume?.type === 'ammo') {
        this.ammo = this.actor.items.get(consume.target)
      }
    }

    if (!params.spentCost) {
      if (item.data.type === 'superpower') {
        // will update:
        // params.spentCost
        // params.targetType
        const returnValue = await this.configureSuperpower()
        if (returnValue === null) return 'error'
      }
    }

    // Convert all requested fields into templates to be entered into the chat message.
    this.templates = await this.allFieldsToTemplates()

    // Check to consume charges. Prevents the roll if charges are required and none are left.
    let chargeCheck = await this.consumeCharge()
    if (chargeCheck === 'error') { return 'error' }

    // Show properties
    this.properties = (params.properties) ? this.listProperties() : null

    let specialPaidCost = null
    if (item.data.type === 'superpower' && params.spentCost !== itemData.cost) {
      const resource = item.mainResource
      const resourceName = item.data.cost === 1 ? resource.nameSingular : resource.name
      specialPaidCost = `${params.spentCost} ${resourceName}`
    }

    let title = (this.params.title || await renderTemplate(
      'modules/betterrolls_kryx_rpg/templates/red-header.html',
      { item, specialPaidCost }))

    // Add token's ID to chat roll, if valid
    let tokenId
    if (actor.token) {
      tokenId = [
        canvas.tokens.get(actor.token.id).scene.id,
        actor.token.id].join('.')
    }

    if (params.useTemplate && item.data.type === 'feature') {
      this.placeTemplate()
    }

    this.rolled = true

    await Hooks.callAll('rollItemBetterRolls', this)

    await new Promise(r => setTimeout(r, 25))

    let content = await renderTemplate(
      'modules/betterrolls_kryx_rpg/templates/red-fullroll.html', {
        item: item,
        actor: actor,
        tokenId: tokenId,
        itemId: item.id,
        isCritical: this.isCrit,
        title: title,
        templates: this.templates,
        properties: this.properties,
      })
    this.content = content

    if (chargeCheck === 'destroy') { await actor.deleteOwnedItem(item.id) }

    return this.content
  }

  /*
    CustomItemRoll(item,
    {
      forceCrit: false,
      quickRoll: false,
      properties: true,
      slotLevel: null,
      useCharge: {},
      useTemplate: false,
      adv: 0,
      disadv: 0,
      triple: 0,
    },
    [
      ["attack", {triggersCrit: true}],
      ["damage", {index:0, versatile:true}],
      ["damage", {index:[1,2,4]}],
    ]
    ).toMessage();
  */
  async fieldToTemplate (field) {
    let item = this.item
    let fieldType = field[0].toLowerCase()
    let fieldArgs = field.slice()
    fieldArgs.splice(0, 1)
    switch (fieldType) {
      case 'attack':
        // {adv, disadv, bonus, triggersCrit, critThreshold}
        this.templates.push(await this.rollAttack(fieldArgs[0]))
        break
      case 'toolcheck':
      case 'tool':
      case 'check':
        this.templates.push(await this.rollTool(fieldArgs[0]))
        break
      case 'damage':
        // {damageIndex: 0, forceVersatile: false, forceCrit: false}
        let index, versatile, crit, context
        let damagesToPush = []
        if (typeof fieldArgs[0] === 'object') {
          index = fieldArgs[0].index
          versatile = fieldArgs[0].versatile
          crit = fieldArgs[0].crit
          context = fieldArgs[0].context
        }
        let oldIndex = index
        if (index === 'all') {
          let newIndex = []
          for (let i = 0; i < this.item.data.data.damage.parts.length; i++) {
            newIndex.push(i)
          }
          index = newIndex
        } else if (Number.isInteger(index)) {
          let newIndex = [index]
          index = newIndex
        }
        for (let i = 0; i < index.length; i++) {
          this.templates.push(await this.rollDamage({
            damageIndex: index[i] || 0,
            // versatile damage will only replace the first damage formula in an "all" damage request
            forceVersatile: (i == 0 || oldIndex !== 'all') ? versatile : false,
            forceCrit: crit,
            customContext: context,
          }))
        }
        if (this.ammo) {
          this.item = this.ammo
          delete this.ammo
          await this.fieldToTemplate([
            'damage',
            {
              index: 'all',
              versatile: false,
              crit,
              context: `[${this.item.name}]`,
            }])
          this.item = item
        }
        break
      case 'savedc':
        // {customSaveId: null, customDC: null}
        let saveId, dc
        if (fieldArgs[0]) {
          saveId = fieldArgs[0].saveId
          dc = fieldArgs[0].dc
        }
        this.templates.push(
          await this.saveRollButton({ customSaveId: saveId, customDC: dc }))
        break
      case 'other':
        if (item.data.data.formula) {
          this.templates.push(await this.rollOther())
        }
        break
      case 'custom':
        /* args:
            title			title of the roll
            formula			the roll formula
            rolls			number of rolls
            rollState		"adv" or "disadv" converts to "highest" or "lowest"
        */
        let rollStates = {
          null: null,
          'adv': 'highest',
          'disadv': 'lowest',
        }
        if (!fieldArgs[0]) {
          fieldArgs[0] = { rolls: 1, formula: '1d20', rollState: null }
        }
        let rollData = duplicate(this.item.actor.data.data)
        rollData.item = item.data.data
        this.addToRollData(rollData)
        let output = await CustomRoll.rollMultiple(fieldArgs[0].rolls,
          fieldArgs[0].formula, ['0'], rollData, fieldArgs[0].title, null,
          rollStates[fieldArgs[0].rollState], false, 'custom')
        output.type = 'custom'
        output.data.rolls.forEach(roll => {
          this.addToDicePool(roll)
        })
        this.templates.push(output)
        break
      case 'description':
      case 'desc':
        // Display info from Components module
        let componentField = ''
        if (game.modules.get('components_kryx_rpg') &&
          game.modules.get('components_kryx_rpg').active) {
          componentField = window.ComponentsModule.getComponentHtml(item, 20)
        }
        fieldArgs[0] = {
          text: componentField + item.data.data.description.value,
        }
      case 'text':
        if (fieldArgs[0].text) {
          this.templates.push({
            type: 'text',
            html: `<div class="card-content br-text">${fieldArgs[0].text}</div>`,
          })
        }
        break
      case 'flavor':
        this.templates.push(this.rollFlavor(fieldArgs[0]))
        break
      case 'crit':
        this.templates.push(await this.rollCritExtra())
        break
    }
    return true
  }

  async allFieldsToTemplates () {
    return new Promise(async (resolve, reject) => {

      for (let i = 0; i < this.fields.length; i++) {
        await this.fieldToTemplate(this.fields[i])
      }

      if (this.isCrit && this.hasDamage &&
        this.item.data.flags.BetterRollsKryxRPG?.critDamage?.value) {
        await this.fieldToTemplate(['crit'])
      }

      resolve(this.templates)
    })
  }

  async toMessage () {
    if (this.rolled) {
      console.log('Already rolled!', this)
    } else {

      let content = await this.roll()
      if (content === 'error') return

      let wd = getWhisperData()

      // Configure sound based on Dice So Nice and Maestro sounds
      let has3DDiceSound = game.dice3d ? game.settings.get('dice-so-nice',
        'settings').enabled : false
      let playRollSounds = this.config.playRollSounds
      let hasMaestroSound = this.config.hasMaestroSound

      this.chatData = {
        user: game.user._id,
        content: this.content,
        speaker: {
          actor: this.actor._id,
          token: this.actor.token,
          alias: this.actor.token?.name || this.actor.name,
        },
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        roll: blankRoll,
        rollMode: wd.rollMode,
        blind: wd.blind,
        sound: (playRollSounds && !hasMaestroSound && !has3DDiceSound)
          ? CONFIG.sounds.dice
          : null,
      }

      if (wd.whisper) { this.chatData.whisper = wd.whisper }

      await Hooks.callAll('messageBetterRolls', this, this.chatData)
      return await createMessage(this)
    }
  }

  /*
  * Updates the rollRequests based on the brkr flags.
  */
  updateForPreset () {
    let item = this.item,
      itemData = item.data.data,
      flags = item.data.flags,
      brFlags = flags.BetterRollsKryxRPG,
      preset = this.params.preset,
      properties = false,
      useCharge = {},
      useTemplate = false,
      fields = [],
      val = (preset === 1) ? 'altValue' : 'value'

    if (brFlags) {
      // Assume new action of the button based on which fields are enabled for Quick Rolls
      function flagIsTrue (flag) {
        return (brFlags[flag] && (brFlags[flag][val] == true))
      }

      function getFlag (flag) {
        return (brFlags[flag] ? (brFlags[flag][val]) : null)
      }

      if (flagIsTrue('quickFlavor') && itemData.chatFlavor) {
        fields.push(['flavor'])
      }
      if (flagIsTrue('quickDesc')) { fields.push(['desc']) }
      if (flagIsTrue('quickAttack') && isAttack(item)) {
        fields.push(['attack'])
      }
      if (flagIsTrue('quickCheck') && isCheck(item)) { fields.push(['check']) }
      if (flagIsTrue('quickSave') && isSave(item)) { fields.push(['savedc']) }

      if (brFlags.quickDamage && (brFlags.quickDamage[val].length > 0)) {
        for (let i = 0; i < brFlags.quickDamage[val].length; i++) {
          let isVersatile = (i == 0) && flagIsTrue('quickVersatile')
          if (brFlags.quickDamage[val][i]) {
            fields.push(['damage', { index: i, versatile: isVersatile }])
          }
        }
      }

      if (flagIsTrue('quickOther')) { fields.push(['other']) }
      if (flagIsTrue('quickProperties')) { properties = true }

      if (brFlags.quickCharges) {
        useCharge = duplicate(getFlag('quickCharges'))
      }
      if (flagIsTrue('quickTemplate')) { useTemplate = true }
    } else {
      //console.log("Request made to Quick Roll item without flags!");
      fields.push(['desc'])
      properties = true
    }

    this.params = mergeObject(this.params, {
      properties,
      useCharge,
      useTemplate,
    })

    this.fields = fields.concat((this.fields || []).slice())
  }

  /**
   * A function for returning the properties of an item, which can then be printed as the footer of a chat card.
   */
  listProperties () {
    let item = this.item
    let properties = []
    let data = item.data.data,
      ad = item.actor.data.data

    let range = ((data.range) && (data.range.value || data.range.units))
      ? (data.range.value || '') +
      (((data.range.long) && (data.range.long !== 0) &&
        (data.rangelong != data.range.value)) ? '/' + data.range.long : '') +
      ' ' + (data.range.units ? kryx_rpg.distanceUnits[data.range.units] : '')
      : null
    let target = (data.target && data.target.type) ? i18n('Target: ').
        concat(kryx_rpg.targetTypes[data.target.type]) +
      ((data.target.units) && (data.target.units !== 'none') ? ' (' +
        data.target.value + ' ' + kryx_rpg.distanceUnits[data.target.units] +
        ')' : '') : null
    let activation = (data.activation && data.activation.type !== '' &&
      data.activation.type !== 'none') ? data.activation.type : null
    let duration = (data.duration && data.duration.units) ? (data.duration.value
      ? data.duration.value + ' '
      : '') + kryx_rpg.timePeriods[data.duration.units] : null
    let activationCondition = (data.activation && data.activation.condition)
      ? '(' + data.activation.condition + ')'
      : null
    switch (item.data.type) {
      case 'weapon':
        properties = [
          kryx_rpg.weaponTypes[data.weaponType],
          range,
          target,
          data.proficient ? '' : i18n('Not Proficient'),
          data.weight ? data.weight + ' ' + i18n('lbs.') : null,
        ]
        for (const prop in data.properties) {
          if (data.properties[prop] === true) {
            properties.push(kryx_rpg.weaponProperties[prop])
          }
        }
        break
      case 'superpower':
        // Spell attack labels
        data.damageLabel = item.isHealing
          ? i18n('brkr.chat.healing')
          : i18n('brkr.chat.damage')
        data.isAttack = item.hasAttack

        let components = data.components

        properties = [
          item.labels.cost,
          item.labels.themes,
          components.ritual ? i18n('Ritual') : null,
          activation,
          duration,
          components.concentration ? i18n('Concentration') : null,
          components.material ? components.material : null,
          range,
          target,
        ]
        break
      case 'feature':
        properties = [
          kryx_rpg.featureTypes[data.featureType],
          ((data.activation.type !== '') && (data.activation.type !== 'none'))
            ? (data.activation.cost ? data.activation.cost + ' ' : '') +
            kryx_rpg.abilityActivationTypes[data.activation.type]
            : null,
          (data.duration.units) ? (data.duration.value ? data.duration.value +
            ' ' : '') + kryx_rpg.timePeriods[data.duration.units] : null,
          range,
          data.target.type ? i18n('Target: ').
              concat(kryx_rpg.targetTypes[data.target.type]) +
            ((data.target.units) && (data.target.units !== 'none') ? ' (' +
              data.target.value + ' ' +
              kryx_rpg.distanceUnits[data.target.units] + ')' : '') : null,
        ]
        break
      case 'consumable':
        properties = [
          data.weight ? data.weight + ' ' + i18n('lbs.') : null,
          ((data.activation.type !== '') && (data.activation.type !== 'none'))
            ? (data.activation.cost ? data.activation.cost + ' ' : '') +
            kryx_rpg.abilityActivationTypes[data.activation.type]
            : null,
          (data.duration.units) ? (data.duration.value ? data.duration.value +
            ' ' : '') + kryx_rpg.timePeriods[data.duration.units] : null,
          range,
          data.target.type ? i18n('Target: ').
              concat(kryx_rpg.targetTypes[data.target.type]) +
            ((data.target.units) && (data.target.units !== 'none') ? ' (' +
              data.target.value + ' ' +
              kryx_rpg.distanceUnits[data.target.units] + ')' : '') : null,
        ]
        break
      case 'equipment':
        properties = [
          kryx_rpg.equipmentTypes[data.armor.type],
          data.equipped ? i18n('Equipped') : null,
          data.armor.value ? data.armor.value + ' ' + i18n('AC') : null,
          data.stealth ? i18n('Stealth Disadv.') : null,
          data.weight ? data.weight + ' lbs.' : null,
        ]
        break
      case 'tool':
        properties = [
          kryx_rpg.proficiencyLevels[data.proficient],
          data.ability ? kryx_rpg.abilities[data.ability] : null,
          data.weight ? data.weight + ' lbs.' : null,
        ]
        break
      case 'loot':
        properties = [data.weight ? item.data.totalWeight + ' lbs.' : null]
        break
    }
    let output = properties.filter(p => (p) && (p.length !== 0) && (p !== ' '))
    return output
  }

  addToRollData (data) {
    data.prof = this.item.actor.data.data.attributes.prof
  }

  /**
   * A function for returning a roll template with crits and fumbles appropriately colored.
   * @param {Object} args          Object containing the html for the roll and whether or not the roll is a crit
   * @param {Roll} rolls            The desired roll to check for crits or fumbles
   * @param {String} selector      The CSS class selection to add the colors to
   * @param {Number} critThreshold  The minimum number required for a critical success (defaults to max roll on the die)
   */
  static tagCrits (args, rolls, selector, critThreshold, critChecks = true) {
    if (typeof args !== 'object') {
      args = {
        html: args,
        isCrit: false,
      }
    }
    if (!rolls) {return args}
    if (!Array.isArray(rolls)) {rolls = [rolls]}
    let $html = $(args.html)
    let rollHtml = $html.find(selector)
    let isCrit = false
    for (let i = 0; i < rollHtml.length; i++) {
      let high = 0,
        low = 0
      rolls[i].dice.forEach(function (d) {
        // Add crit for improved crit threshold
        let threshold = critThreshold || d.faces
        debug('SIZE ' + d.faces)
        debug('VALUE ' + d.total)
        if (d.faces > 1 &&
          (critChecks == true || critChecks.includes(d.faces))) {
          d.results.forEach(function (result) {
            if (result.result >=
              threshold) { high += 1 } else if (result.result ==
              1) { low += 1 }
          })
        }
      })
      debug('CRITS', high)
      debug('FUMBLES', low)

      if ((high > 0) && (low == 0)) $($html.find(selector)[i]).
        addClass('success')
      else if ((high == 0) && (low > 0)) $($html.find(selector)[i]).
        addClass('failure')
      else if ((high > 0) && (low > 0)) $($html.find(selector)[i]).
        addClass('mixed')
      if ((high > 0) || (args.isCrit == true)) isCrit = true
    }
    return {
      html: $html[0].outerHTML,
      isCrit: isCrit,
    }
  }

  /*
    Rolls an attack roll for the item.
    @param {Object} args				Object containing all named parameters
      @param {Number} adv				1 for advantage
      @param {Number} disadv			1 for disadvantage
      @param {String} bonus			Additional situational bonus
      @param {Boolean} triggersCrit	Whether a crit for this triggers future damage rolls to be critical
      @param {Number} critThreshold	Minimum roll for a d20 is considered a crit
  */
  async rollAttack (preArgs) {
    let args = mergeObject({
      adv: this.params.adv,
      disadv: this.params.disadv,
      triple: this.params.triple,
      bonus: null,
      triggersCrit: true,
      critThreshold: null,
    }, preArgs || {})
    let item = this.item
    // Prepare roll data
    let itemData = item.data.data,
      actorData = item.actor.data.data,
      title = (this.config.rollTitlePlacement !== '0') ? i18n(
        'brkr.chat.attack') : null,
      parts = [],
      rollData = duplicate(actorData)

    this.addToRollData(rollData)
    this.hasAttack = true

    // Add critical threshold (... probably irrelevant in KryxRPG)
    let critThreshold = 20
    let characterCrit = 20
    try {
      characterCrit = Number(getProperty(item, 'actor.data.flags.kryx_rpg.weaponCriticalThreshold')) || 20
    } catch (error) {
      characterCrit = item.actor.data.flags.kryx_rpg.weaponCriticalThreshold || 20
    }

    let itemCrit = Number(getProperty(item, 'data.flags.BetterRollsKryxRPG.critRange.value')) || 20
    //	console.log(critThreshold, characterCrit, itemCrit);

    // If a specific critThreshold is set, use that
    if (args.critThreshold) {
      critThreshold = args.critThreshold
      // Otherwise, determine it from character & item data
    } else {
      if (['mwak', 'rwak'].includes(itemData.actionType)) {
        critThreshold = Math.min(critThreshold, characterCrit, itemCrit)
      } else {
        critThreshold = Math.min(critThreshold, itemCrit)
      }
    }

    // Add ability value bonus
    const abl = this.item.abilityMod

    if (abl.length) {
      parts.push(`@abl`)
      rollData.abl = actorData.abilities[abl]?.value
      //console.log("Adding Ability value", abl);
    }

    // Add proficiency modifier
    if (item.data.type === 'superpower' || item.data.type === 'feature' || itemData.proficient) {
      parts.push(`@prof`)
      rollData.prof = Math.floor(actorData.attributes.prof)
      //console.log("Adding Proficiency value!");
    }

    // Add item's bonus
    if (itemData.attackBonus) {
      parts.push(`@bonus`)
      rollData.bonus = itemData.attackBonus
      //console.log("Adding Bonus value!", itemData);
    }

    if (this.ammo?.data) {
      const ammoBonus = this.ammo.data.data.attackBonus
      if (ammoBonus) {
        parts.push('@ammo')
        rollData['ammo'] = ammoBonus
        title += ` [${this.ammo.name}]`
      }
    }

    // Add custom situational bonus
    if (args.bonus) {
      parts.push(args.bonus)
    }

    if (actorData.bonuses && isAttack(item)) {
      let actionType = `${itemData.actionType}`
      if (actorData?.bonuses[actionType]?.attack) {
        parts.push('@' + actionType)
        rollData[actionType] = actorData.bonuses[actionType].attack
      }
    }

    // Establish number of rolls using advantage/disadvantage
    let adv = this.params.adv || args.adv
    let disadv = this.params.disadv || args.disadv
    let triple = this.params.triple || args.triple

    let rollState = CustomRoll.getRollState({ adv, disadv, triple })

    let numRolls = this.config.d20Mode

    if (rollState) {
      numRolls = 2
    }
    if (triple) {
      numRolls = 3
    }

    let d20String = '1d20'

    // Halfling Luck check
    if (Utils.isHalfling(item.actor)) {
      d20String = '1d20r<2'
    }

    let output = mergeObject({ type: 'attack' },
      await CustomRoll.rollMultiple(numRolls, d20String, parts, rollData, title,
        critThreshold, rollState, args.triggersCrit))
    if (output.isCrit) {
      this.isCrit = true
    }
    output.type = 'attack'

    output.data.rolls.forEach(roll => {
      this.addToDicePool(roll)
    })

    return output
  }

  async damageTemplate ({ baseRoll, critRoll, labels, type }) {
    let baseTooltip = await baseRoll.getTooltip(),
      templateTooltip

    if (baseRoll.terms.length === 0) return

    if (critRoll) {
      let critTooltip = await critRoll.getTooltip()
      templateTooltip = await renderTemplate(
        'modules/betterrolls_kryx_rpg/templates/red-dualtooltip.html',
        { lefttooltip: baseTooltip, righttooltip: critTooltip })
    } else { templateTooltip = baseTooltip }

    let chatData = {
      tooltip: templateTooltip,
      lefttotal: baseRoll.total,
      righttotal: (critRoll ? critRoll.total : null),
      damagetop: labels[1],
      damagemid: labels[2],
      damagebottom: labels[3],
      formula: baseRoll.formula,
      crittext: this.config.critString,
      damageType: type,
      maxRoll: await new Roll(baseRoll.formula).evaluate(
        { maximize: true }).total,
      maxCrit: critRoll ? await new Roll(critRoll.formula).evaluate(
        { maximize: true }).total : null,
    }

    let html = {
      html: await renderTemplate(
        'modules/betterrolls_kryx_rpg/templates/red-damageroll.html', chatData),
    }
    html = CustomItemRoll.tagCrits(html, baseRoll, '.red-base-die')
    html = CustomItemRoll.tagCrits(html, critRoll, '.red-extra-die')

    let output = {
      type: 'damage',
      html: html['html'],
      data: chatData,
    }

    return output
  }

  async rollDamage ({ damageIndex = 0, forceVersatile = false, forceCrit = false, bonus = 0, customContext = null }) {
    let item = this.item
    let itemData = item.data.data,
      rollData = duplicate(item.actor.data.data),
      abl = itemData.ability,
      flags = item.data.flags.BetterRollsKryxRPG,
      damageFormula,
      damageType = itemData.damage.parts[damageIndex][1],
      isVersatile = false,
      spentCost = this.params.spentCost

    rollData.item = duplicate(itemData)
    rollData.item.spentCost = spentCost
    this.addToRollData(rollData)

    // Makes the custom roll flagged as having a damage roll.
    this.hasDamage = true

    // Change first damage formula if versatile
    if (((this.params.versatile && damageIndex === 0) || forceVersatile) &&
      itemData.damage.versatile.length > 0) {
      damageFormula = itemData.damage.versatile
      isVersatile = true
    } else {
      damageFormula = itemData.damage.parts[damageIndex][0]
    }

    if (!damageFormula) { return null }

    let type = item.data.type,
      parts = [],
      dtype = CONFIG.BetterRollsKryxRPG.combinedDamageTypes[damageType]

    // Superpowers don't push their abilities to damage by default. This is here so the user can add "+ @value" to their damage roll if they wish.
    if (type === 'superpower') {
      abl = itemData.ability ? itemData.ability : item.abilityMod
    }

    // Applies ability on weapon and feat damage rolls, but only for the first damage roll listed on the item.
    if (!abl && (type === 'weapon' || type === 'feature') && damageIndex === 0) {
      if (type === 'weapon') {
        if (itemData.properties.fin &&
          (itemData.ability === 'str' || itemData.ability === 'dex' ||
            itemData.ability === '')) {
          if (rollData.abilities.str.value >=
            rollData.abilities.dex.value) { abl = 'str' } else { abl = 'dex' }
        } else if (itemData.actionType === 'mwak') {
          abl = 'str'
        } else if (itemData.actionType === 'rwak') {
          abl = 'dex'
        }
      }
    }

    // Users may add "+ @value" to their rolls to manually add the ability value to their rolls.
    rollData.value = (abl !== '') ? rollData.abilities[abl]?.value : 0

    // Prepare roll label
    let titlePlacement = this.config.damageTitlePlacement.toString(),
      damagePlacement = this.config.damageRollPlacement.toString(),
      contextPlacement = this.config.damageContextPlacement.toString(),
      replaceTitle = this.config.contextReplacesTitle,
      replaceDamage = this.config.contextReplacesDamage,
      labels = {
        '1': [],
        '2': [],
        '3': [],
      }

    let titleString = '',
      damageString = [],
      contextString = customContext ||
        (flags.quickDamage.context && flags.quickDamage.context[damageIndex])

    // Show "Healing" prefix only if it's not inherently a heal action
    if (['healing', 'temphp', 'totalhp'].includes(
      damageType)) { titleString = '' }
    // Show "Damage" prefix if it's a damage roll
    else if (kryx_rpg.damageTypes[damageType]) {
      titleString += i18n('brkr.chat.damage')
    }

    // Title
    let pushedTitle = false
    if (titlePlacement !== '0' && titleString &&
      !(replaceTitle && contextString && titlePlacement == contextPlacement)) {
      labels[titlePlacement].push(titleString)
      pushedTitle = true
    }

    // Context
    if (contextString) {
      if (contextPlacement === titlePlacement && pushedTitle) {
        labels[contextPlacement][0] = (labels[contextPlacement][0]
          ? labels[contextPlacement][0] + ' '
          : '') + '(' + contextString + ')'
      } else {
        labels[contextPlacement].push(contextString)
      }
    }

    // Damage type
    if (dtype) { damageString.push(dtype) }
    if (isVersatile) {
      damageString.push('(' + kryx_rpg.weaponProperties.ver + ')')
    }
    damageString = damageString.join(' ')
    if (damagePlacement !== '0' && damageString.length > 0 &&
      !(replaceDamage && contextString && damagePlacement == contextPlacement)) {
      labels[damagePlacement].push(damageString)
    }

    for (let p in labels) {
      labels[p] = labels[p].join(' - ')
    }

    if (damageIndex === 0) {
      damageFormula = this.scaleDamage(damageIndex, isVersatile, rollData) ||
        damageFormula
    }

    let bonusAdd = ''
    if (damageIndex === 0 && rollData.bonuses && isAttack(item)) {
      let actionType = `${itemData.actionType}`
      if (rollData.bonuses[actionType].damage) {
        bonusAdd = '+' + rollData.bonuses[actionType].damage
      }
    }

    let baseDice = damageFormula + bonusAdd
    let baseWithParts = [baseDice]
    if (parts) {baseWithParts = [baseDice].concat(parts)}

    let rollFormula = baseWithParts.join('+')

    let baseRoll = await new Roll(rollFormula, rollData).roll(),
      critRoll = null,
      baseMaxRoll = null,
      critBehavior = this.params.critBehavior
        ? this.params.critBehavior
        : this.config.critBehavior

    this.addToDicePool(baseRoll)

    if ((forceCrit == true || (this.isCrit && forceCrit !== 'never')) &&
      critBehavior !== '0') {
      critRoll = await this.critRoll(rollFormula, rollData, baseRoll)
    }

    let damageRoll = await this.damageTemplate({
      baseRoll: baseRoll,
      critRoll: critRoll,
      labels: labels,
      type: damageType,
    })

    return damageRoll
  }

  /*
  * Rolls critical damage based on a damage roll's formula and output.
  * This critical damage should not overwrite the base damage - it should be seen as "additional damage dealt on a crit", as crit damage may not be used even if it was rolled.
  */

  async critRoll (rollFormula, rollData, baseRoll) {
    let item = this.item
    let critBehavior = this.params.critBehavior
      ? this.params.critBehavior
      : this.config.critBehavior
    let critFormula = rollFormula.replace(
      /[+-]+\s*(?:@[a-zA-Z0-9.]+|[0-9]+(?![Dd]))/g, '').concat()
    let critRollData = duplicate(rollData)
    critRollData.value = 0  // doesn't add mod/value to crit damage
    let critRoll = await new Roll(critFormula)
    let savage

    // If the crit formula has no dice, return null
    if (critRoll.terms.length === 1 && typeof critRoll.terms[0] ===
      'number') { return null }

    if (item.data.type === 'weapon') {
      try {
        savage = item.actor.getFlag('kryx_rpg', 'savageAttacks')
      } catch (error) {
        savage = item.actor.getFlag('kryx_rpgJP', 'savageAttacks')
      }
    }
    let add = (item.actor && savage) ? 1 : 0
    critRoll.alter(1, add)
    critRoll.roll()

    // If critBehavior = 2, maximize base dice
    if (critBehavior === '2') {
      critRoll = await new Roll(critRoll.formula).evaluate({ maximize: true })
    }

    // If critBehavior = 3, maximize base and crit dice
    else if (critBehavior === '3') {
      let maxDifference = Roll.maximize(baseRoll.formula).total -
        baseRoll.total
      let newFormula = critRoll.formula + '+' + maxDifference.toString()
      critRoll = await new Roll(newFormula).evaluate({ maximize: true })
    }

    this.addToDicePool(critRoll)

    return critRoll
  }

  scaleDamage (damageIndex, versatile, rollData) {
    let item = this.item
    if (item.data.type !== 'superpower') return null

    // copied code from kryxrpg item/entity.js
    const itemData = item.data.data
    const actorData = item.actor.data.data
    const augmentedCost = this.params.spentCost
    const parts = itemData.damage.parts.map(d => d[0])
    const scalingMode = itemData.scaling.mode
    if (scalingMode === 'none') {
      // do nothing
    } else if (scalingMode === 'cantrip') {
      item._scaleCantripDamage(parts, actorData.class.level, itemData.scaling.formula, rollData)
    } else if (scalingMode === 'augment' || scalingMode === 'enhance') {
      if (augmentedCost !== null && augmentedCost !== itemData.cost) {
        item._scaleSuperpowerDamage(parts, itemData.cost, augmentedCost, itemData.scaling.formula, rollData)
      }
    } else {
      ui.notifications.error(`Unexpected scaling mode: ${scalingMode}`)
    }
    return parts.join(' + ')
  }

  async rollCritExtra (index) {
    let damageIndex = (index ? toString(index) : null) ||
      this.item.data.flags.BetterRollsKryxRPG?.critDamage?.value || ''
    if (damageIndex) {
      return await this.rollDamage(
        { damageIndex: Number(damageIndex), forceCrit: 'never' })
    }
  }

  /*
  Rolls the Other Formula field. Is subject to crits.
  */
  async rollOther (preArgs) {
    let args = mergeObject({}, preArgs || {})
    let item = this.item
    let isCrit = this.isCrit
    let itemData = item.data.data,
      formula = item.data.data.formula,
      rollData = duplicate(item.actor.data.data),
      flags = item.data.flags.BetterRollsKryxRPG

    this.addToRollData(rollData)

    let titlePlacement = this.config.damageTitlePlacement,
      contextPlacement = this.config.damageContextPlacement,
      replaceTitle = this.config.contextReplacesTitle,
      labels = {
        '1': [],
        '2': [],
        '3': [],
      }

    // Title
    let titleString = i18n('brkr.chat.other'),
      contextString = flags.quickOther.context

    let pushedTitle = false
    if (titlePlacement !== '0' &&
      !(replaceTitle && contextString && titlePlacement == contextPlacement)) {
      labels[titlePlacement].push(titleString)
      pushedTitle = true
    }

    // Context
    if (contextString) {
      if (contextPlacement === titlePlacement && pushedTitle) {
        labels[contextPlacement][0] = (labels[contextPlacement][0]
          ? labels[contextPlacement][0] + ' '
          : '') + '(' + contextString + ')'
      } else {
        labels[contextPlacement].push(contextString)
      }
    }

    let baseRoll = await new Roll(formula, rollData).roll(),
      critRoll = null,
      baseMaxRoll = null,
      critBehavior = this.params.critBehavior
        ? this.params.critBehavior
        : this.config.critBehavior

    if (isCrit && critBehavior !== '0') {
      critRoll = await this.critRoll(formula, rollData, baseRoll)
    }

    let output = this.damageTemplate(
      { baseRoll: baseRoll, critRoll: critRoll, labels: labels });

    [baseRoll, critRoll].forEach(roll => {
      this.addToDicePool(roll)
    })

    return output
  }

  /* 	Generates the html for a save button to be inserted into a chat message. Players can click this button to perform a roll through their controlled token.
  */
  async saveRollButton ({ customSaveId = null, customDC = null }) {
    let item = this.item
    let actor = item.actor
    let saveData = getSave(item)
    if (customSaveId) { saveData.saveId = saveArgs.customSaveId }
    if (customDC) { saveData.dc = saveArgs.customDC }

    let hideDC = (this.config.hideDC == '2' ||
      (this.config.hideDC == '1' && actor.data.type == 'npc')) // Determine whether the DC should be hidden

    let divHTML = `<span ${hideDC
      ? 'class="hideSave"'
      : ''} style="display:inline;line-height:inherit;">${saveData.dc}</span>`

    let saveLabel = `${i18n('brkr.buttons.saveDC')} ` + divHTML +
      ` ${kryx_rpg.saves[saveData.saveId]}`
    let button = {
      type: 'saveDC',
      html: await renderTemplate(
        'modules/betterrolls_kryx_rpg/templates/red-save-button.html',
        { data: saveData, saveLabel: saveLabel }),
    }

    return button
  }

  async rollTool (preArgs) {
    let args = mergeObject({
      adv: 0,
      disadv: 0,
      triple: 0,
      bonus: null,
      triggersCrit: true,
      critThreshold: null,
      rollState: this.rollState,
    }, preArgs || {})
    let item = this.item
    // Prepare roll data
    let itemData = item.data.data,
      actorData = item.actor.data.data,
      title = args.title || ((this.config.rollTitlePlacement != '0')
        ? i18n('brkr.chat.check')
        : null),
      parts = [],
      rollData = duplicate(actorData)
    rollData.item = itemData
    this.addToRollData(rollData)

    // Add ability modifier bonus
    if (itemData.ability) {
      let abl = (itemData.ability),
        value = abl ? actorData.abilities[abl].value : 0
      if (value !== 0) {
        parts.push('@value')
        rollData.value = value
      }
    }

    // Add proficiency, expertise, or Jack of all Trades
    if (itemData.proficient) {
      parts.push('@prof')
      rollData.prof = Math.floor(
        itemData.proficient * actorData.attributes.prof)
      //console.log("Adding Proficiency mod!");
    }

    // Add item's bonus
    if (itemData.bonus) {
      parts.push('@bonus')
      rollData.bonus = itemData.bonus.value
      //console.log("Adding Bonus mod!");
    }

    if (args.bonus) {
      parts.push(bonus)
    }

    // Halfling Luck check
    let d20String = '1d20'
    if (Utils.isHalfling(item, actor)) {
      d20String = '1d20r<2'
    }

    //(numRolls = 1, dice = "1d20", parts = [], data = {}, title, critThreshold, rollState, triggersCrit = false)
    let output = await CustomRoll.rollMultiple(this.config.d20Mode, d20String,
      parts, rollData, title, args.critThreshold, args.rollState,
      args.triggersCrit)
    if (output.isCrit && triggersCrit) {
      this.isCrit = true
    }

    output.data.rolls.forEach(roll => {
      this.addToDicePool(roll)
    })

    return output
  }

  // Rolls the flavor text of the item, or custom text if any was entered.
  rollFlavor (preArgs) {
    let args = mergeObject({ text: this.item.data.data.chatFlavor },
      preArgs || {})

    return {
      type: 'flavor',
      html: `<div class="brkr-roll-label br-flavor">${args.text}</div>`,
    }
  }

  async configureSuperpower () {
    let item = this.item
    let actor = item.actor

    let spentCost = item.data.data.cost
    let shouldConsumeResources = true
    let placeTemplate = false
    let selectedTargetType = item.data.data.target.type

    const canChooseTargetType = item.data.data.target.type === 'coneOrLine'
    const resource = actor.data.data.mainResources[item.isManeuver ? 'stamina' : 'mana']
    const hasReasonToConfigureDialog = item.hasPlaceableTemplate
      || (spentCost > 0 && spentCost < resource.limit) // can augment
      || canChooseTargetType
    if (hasReasonToConfigureDialog) {
      // console.log('level > 0')
      window.PH = {}
      window.PH.actor = actor
      window.PH.item = item
      const superpowerFormData = await game.kryx_rpg.applications.SuperpowerUseDialog.create(actor, item)
      if (superpowerFormData === null) return null
      spentCost = parseInt(superpowerFormData.get('spentCost'))
      shouldConsumeResources = Boolean(superpowerFormData.get('shouldConsumeResources'))
      placeTemplate = Boolean(superpowerFormData.get('shouldPlaceTemplate'))
      if (canChooseTargetType) {
        const useLineTargetType = Boolean(superpowerFormData.get('useLineTargetType'))
        if (useLineTargetType) {
          selectedTargetType = 'line'
        } else {
          selectedTargetType = 'cone'
        }
      }
    }
    const targetType = selectedTargetType
    this.params.spentCost = spentCost
    this.params.targetType = targetType

    // Update Actor data
    if (shouldConsumeResources && spentCost) {
      const resourceName = item.isManeuver ? 'stamina' : 'mana'
      // WARNING!
      // when the actor updates, it updates the data of all of its items, and this updates this item's data
      // which will wipe out the BetterRolls flags, if they didn't exist
      // therefore, I'm adding a hotfix here, because I'm too dumb to solve it correctly
      const bf = this.item.data.flags.BetterRollsKryxRPG
      await actor.update({
        [`data.mainResources.${resourceName}.remaining`]: Math.max(resource.remaining - spentCost, 0),
      })
      this.item.data.flags.BetterRollsKryxRPG = bf
    }

    if (placeTemplate) {
      this.placeTemplate()
    }
    return this.params
  }

  // Places a template if the item has an area of effect
  placeTemplate () {
    let item = this.item
    const params = this.params
    const scaling = params.spentCost || item.data.data.cost || 1
    const targetType = params.targetType || item.data.data.target.type
    if (item.hasPlaceableTemplate) {
      const template = game.kryx_rpg.canvas.AbilityTemplate.fromItem(item, scaling, targetType)
      if (template) template.drawPreview(event)
      if (item.actor && item.actor.sheet) {
        if (item.sheet.rendered) item.sheet.minimize()
        if (item.actor.sheet.rendered) item.actor.sheet.minimize()
      }
    }
  }

  // Consumes charges & resources assigned on an item.
  async consumeCharge () {
    let item = this.item,
      itemData = item.data.data

    const hasUses = !!(itemData.uses.value || itemData.uses.max ||
      itemData.uses.per) // Actual check to see if uses exist on the item, even if params.useCharge.use == true
    const hasResource = !!(itemData.consume?.target) // Actual check to see if a resource is entered on the item, even if params.useCharge.resource == true

    const request = this.params.useCharge // Has bools for quantity, use, resource, and charge
    const recharge = itemData.recharge || {}
    const uses = itemData.uses || {}
    const autoDestroy = uses.autoDestroy
    const current = uses.value || 0
    const remaining = request.use ? Math.max(current - 1, 0) : current
    const q = itemData.quantity
    const updates = {}
    let output = 'success'

    // Check for consuming uses, but not quantity
    if (hasUses && request.use && !request.quantity) {
      if (!current) {
        ui.notifications.warn(
          game.i18n.format('KRYX_RPG.ItemNoUses', { name: item.name }))
        return 'error'
      }
    }

    // Check for consuming quantity, but not uses
    if (request.quantity && !request.use) {
      if (!q) {
        ui.notifications.warn(
          game.i18n.format('KRYX_RPG.ItemNoUses', { name: item.name }))
        return 'error'
      }
    }

    // Check for consuming quantity and uses
    if (hasUses && request.use && request.quantity) {
      if (!current && q <= 1) {
        ui.notifications.warn(
          game.i18n.format('KRYX_RPG.ItemNoUses', { name: item.name }))
        return 'error'
      }
    }

    // Check for consuming charge ("Action Recharge")
    if (request.charge) {
      if (!recharge.charged) {
        ui.notifications.warn(
          game.i18n.format('KRYX_RPG.ItemNoUses', { name: item.name }))
        return 'error'
      }
    }

    // Check for consuming resource.
    // Note that _handleResourceConsumption() will actually consume the resource as well as perform the check, hence why it must be performed last.
    if (hasResource && request.resource) {
      const allowed = await item._handleResourceConsumption(
        { isCard: true, isAttack: true })
      if (allowed === false) { return 'error' }
    }

    // Handle uses, but not quantity
    if (hasUses && request.use && !request.quantity) {
      updates['data.uses.value'] = remaining
    }

    // Handle quantity, but not uses
    else if (request.quantity && !request.use) {
      if (q <= 1 && autoDestroy) {
        output = 'destroy'
      }
      updates['data.quantity'] = q - 1
    }

    // Handle quantity and uses
    else if (hasUses && request.use && request.quantity) {
      let remainingU = remaining
      let remainingQ = q
      console.log(remainingQ, remainingU)
      if (remainingU < 1) {
        remainingQ -= 1
        ui.notifications.warn(
          game.i18n.format('brkr.error.autoDestroy', { name: item.name }))
        if (remainingQ >= 1) {
          remainingU = itemData.uses.max || 0
        } else { remainingU = 0 }
        if (remainingQ < 1 && autoDestroy) { output = 'destroy' }
      }

      updates['data.quantity'] = Math.max(remainingQ, 0)
      updates['data.uses.value'] = Math.max(remainingU, 0)
    }

    // Handle charge ("Action Recharge")
    if (request.charge) {
      updates['data.recharge.charged'] = false
    }

    item.update(updates)

    return output
  }
}