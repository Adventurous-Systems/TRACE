# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TRACE (Transforming Resources and Advancing Circular Economy) is a research project developing a prototype digital marketplace for construction material reuse hubs in Scotland. The project addresses Scotland's 98.7% circularity gap by creating a trustworthy, real-time tracking system connecting stakeholders across the construction material reuse ecosystem.

**Key Technologies**: Blockchain, IoT, material passports, QR codes

**Research Team**:
- Dr Michele Victoria - Lecturer, Robert Gordon University, Aberdeen
- Dr Theodoros Dounas - Associate Professor, Heriot Watt University, Edinburgh

**Project Partners**: Stirling Reuse Hub (SRH), Adventurous Systems, BE-ST, Zero Waste Scotland

## Repository Structure

This repository is primarily a **research documentation repository** rather than a software project. It contains:

- `README.md` - Project overview, research team, and partner information
- `methods/` - Research methodology documentation and diagrams
  - `methods.md` - Links to token engineering tools and frameworks
  - `TRACE_methods_diagram.drawio` - Methodology diagram (Draw.io format)

## Development Context

### Current State
- This is a **documentation-focused repository** transitioning to include smart contract development
- **Blockchain**: Ethereum Virtual Machine (EVM) compatible, targeting Layer 2 solutions (Polygon, Arbitrum, or Optimism)
- **Smart Contracts**: Solidity for on-chain logic
- **User Space & Frontend**: Python for backend services and user interfaces
- **Architecture**: Dual-token system with digital material passports (NFTs)

### Research Focus Areas
The project addresses:
1. Limited availability of reuse hubs across Scotland
2. Lack of timely, trustworthy information for incorporating reused materials into construction projects

### Token Engineering Resources
The project references several token engineering frameworks and tools (see `methods/methods.md`):
- TokenLab, TokenSim, Simcraft
- cadCAD ecosystem (radCAD, cadCADStudyGroup)
- Machinations
- QTM Interface

### Research on Token Design
Research on TRACE has multiple complex targets to develop a full marketplace.
- Two phases: MVP1 focusing on traceability and MVP2 focusing on the full market
- MVP1:traceability develops the mechanics of tracing materials in the Stirling reuse hub. This has its own specs and engineering focusing on a frictionaless experience. Initially it develops a registry and a digital product passport(i.e two smart contracts)
- MVP2:digital market requires the mapping of stakeholders, activiies between the stakerholders, mapping of the common pool resources system, and value pockets within the market. This then will be modelled in a token engineering system like CADCAM to ascertain viability of the market. 

## Smart Contract Architecture

### Overview
TRACE implements a blockchain-based circular economy marketplace using a dual-token system with digital material passports. The architecture enables trustless material tracking, stakeholder governance, and economic incentives for sustainable construction practices.

### Core Components

#### 1. Material Passport NFT System
**Contract**: `MaterialPassport.sol` (ERC-721 compliant)

Digital passports are non-fungible tokens representing unique construction materials or components. Each passport contains:

- **Material Identity**: Type, origin, manufacturer, batch number
- **Physical Properties**: Dimensions, weight, material composition, structural ratings
- **Lifecycle Data**: Manufacturing date, installation history, maintenance records, carbon footprint
- **Chain of Custody**: Complete ownership and location history
- **Verification Status**: IoT sensor data, QR code linkage, third-party certifications
- **Condition Assessment**: Current state, remaining lifespan, reuse potential
- **Metadata URI**: IPFS link to detailed documentation, images, technical specifications

**Key Functions**:
- `mintPassport()`: Create new material passport (restricted to verified reuse hubs)
- `updateCondition()`: Update material status via IoT integration or inspector verification
- `transferPassport()`: Transfer ownership through marketplace or direct sale
- `retirePassport()`: Mark material as end-of-life (non-reversible)
- `verifyAuthenticity()`: Validate passport against physical QR code

#### 2. Dual-Token Economic Model

##### a) TRACE Governance Token (TRC)
**Contract**: `TRACEGovernance.sol` (ERC-20 compliant)

- **Purpose**: Democratic governance of the TRACE ecosystem
- **Distribution**:
  - 40% - Active participants (reuse hubs, builders, salvagers) via staking and participation
  - 25% - Research consortium and development team (vested over 4 years)
  - 20% - Community treasury for ecosystem development
  - 15% - Early supporters and project partners
- **Governance Rights**:
  - Propose and vote on protocol upgrades
  - Set marketplace fee structures
  - Approve new reuse hub registrations
  - Adjust reward emission rates
  - Allocate treasury funds for grants and sustainability initiatives
- **Voting Power**: 1 token = 1 vote, with time-weighted multipliers for long-term holders
- **Proposal Threshold**: 1% of total supply to create proposals
- **Quorum**: 10% of circulating supply must participate for valid votes

##### b) REUSE Reward Token (RUS)
**Contract**: `REUSERewards.sol` (ERC-20 compliant)

- **Purpose**: Economic incentives for circular economy participation
- **Earning Mechanisms**:
  - Listing materials on marketplace (supply-side incentive)
  - Purchasing reused materials vs. virgin materials (demand-side incentive)
  - Verifying material conditions (quality assurance)
  - Achieving carbon footprint reduction milestones
  - Successful material reuse cycles (longevity bonus)
- **Utility**:
  - Reduced marketplace transaction fees
  - Priority access to high-demand materials
  - Convertible to TRC governance tokens (bonding curve)
  - Redeemable for services (certification, transport, assessment)
- **Emission Schedule**: Decreasing rewards over 10 years to encourage early adoption
- **Max Supply**: 1 billion RUS tokens

#### 3. Marketplace Contract
**Contract**: `TRACEMarketplace.sol`

Central hub for material trading with integrated passport verification.

**Features**:
- **Listing Creation**: Sellers create listings tied to Material Passport NFTs
- **Price Discovery**: Dutch auctions, fixed-price sales, or offer-based negotiations
- **Escrow System**: Automated smart contract escrow for secure transactions
- **Fee Structure**: 2.5% platform fee (0.5% to treasury, 2% distributed to TRC stakers)
- **Quality Guarantees**: Dispute resolution mechanism with arbitration
- **Search & Filter**: Off-chain indexing with on-chain verification
- **RUS Rewards**: Automatic distribution upon successful transactions

**Key Functions**:
- `createListing()`: List material with passport verification
- `purchaseMaterial()`: Buy material with automatic passport transfer
- `makeOffer()`: Submit offer below asking price
- `cancelListing()`: Remove listing and return passport to seller
- `reportDispute()`: Initiate quality dispute resolution

#### 4. Governance Contract
**Contract**: `TRACEGovernor.sol` (OpenZeppelin Governor framework)

Democratic decision-making for the TRACE ecosystem.

**Proposal Types**:
1. **Protocol Upgrades**: Changes to smart contract logic
2. **Parameter Adjustments**: Fee rates, reward emissions, thresholds
3. **Hub Registration**: Approve new reuse hubs as verified participants
4. **Treasury Allocation**: Grant funding for research, hub expansion, sustainability programs
5. **Emergency Actions**: Circuit breakers, pause mechanisms

**Governance Process**:
1. **Proposal Submission** (3-day discussion period)
2. **Voting Period** (7 days)
3. **Timelock** (2-day delay before execution)
4. **Execution** (automatic via smart contract)

**Security Features**:
- Multi-signature override for critical emergencies (6 of 9 research consortium + partners)
- Quadratic voting option to prevent whale dominance
- Delegation system for passive token holders

#### 5. Staking Contract
**Contract**: `TRACEStaking.sol`

Incentivizes long-term participation and governance engagement.

**Staking Benefits**:
- Earn portion of marketplace fees (2% of transaction volume)
- Increased governance voting power (up to 2x multiplier for 1-year stakes)
- Exclusive access to RUS → TRC conversion bonding curve
- Priority dispute arbitration rights

**Staking Tiers**:
- Bronze: 1,000+ TRC (3-month lock)
- Silver: 10,000+ TRC (6-month lock)
- Gold: 50,000+ TRC (12-month lock)

#### 6. Oracle Integration
**Contract**: `TRACEOracle.sol`

Bridges off-chain data with on-chain smart contracts.

**Data Feeds**:
- IoT sensor data from material storage facilities
- Virgin material pricing for carbon footprint comparisons
- Carbon credit valuations
- Third-party certification verification
- Weather/environmental data affecting material conditions

**Providers**: Chainlink, Band Protocol, or custom oracle network

### Contract Interaction Flow

```
User Actions → Frontend (Python) → Web3 Provider → Layer 2 Network
                                                          ↓
Material Passport NFT ←→ TRACE Marketplace ←→ REUSE Rewards
         ↓                       ↓                    ↓
    Governance ←← TRC Tokens ←→ Staking Contract
         ↓
    Treasury & Grants
```

### Security Considerations

1. **Access Control**: Role-based permissions (OpenZeppelin AccessControl)
2. **Upgradeability**: Transparent proxy pattern with governance-controlled upgrades
3. **Rate Limiting**: Prevent spam attacks on minting/listing functions
4. **Oracle Validation**: Multiple data source verification before critical decisions
5. **Audit Requirements**: Third-party security audits before mainnet deployment
6. **Emergency Pause**: Circuit breaker for critical vulnerabilities
7. **Sybil Resistance**: KYC for high-value transactions, reputation systems

### Governance Model

#### Stakeholder Participation
The TRACE marketplace operates as a **commons-based peer production system** where participants collectively govern shared resources (construction materials) while maintaining individual economic incentives.

#### Governance Principles

1. **Inclusive Decision-Making**: All ecosystem participants can earn governance rights through active participation, not just financial investment

2. **Polycentric Governance**: Multiple decision-making centers
   - **Protocol Level**: Core smart contract upgrades (TRC token holders)
   - **Hub Level**: Individual reuse hub operational decisions (local governance)
   - **Community Level**: Standards, certifications, best practices (working groups)

3. **Ostrom's Common Pool Resource Framework**:
   - **Clearly Defined Boundaries**: Verified hub registration, material authentication
   - **Congruence**: Locally adapted rules for Scottish context (different hubs, different needs)
   - **Collective Choice**: Users affected by rules participate in modifying rules
   - **Monitoring**: IoT sensors, community reporting, third-party audits
   - **Graduated Sanctions**: Reputation scores, temporary suspensions, permanent bans
   - **Conflict Resolution**: Built-in arbitration mechanisms
   - **Recognition of Rights**: Government acknowledgment through Zero Waste Scotland partnership

4. **Quadratic Governance**: Optional quadratic voting prevents plutocracy
   - Cost to vote = (number of votes)²
   - Encourages broad consensus over whale dominance

5. **Futarchy Elements**: Prediction markets for major decisions
   - "Bet on outcomes, vote on values"
   - E.g., market predicts impact of fee changes before implementation

#### Governance Bodies

1. **Token Holders Assembly**: All TRC holders vote on proposals
2. **Technical Committee**: 7 members (elected) review protocol upgrades
3. **Hub Council**: Representatives from verified reuse hubs (rotating membership)
4. **Research Advisory**: Academic partners provide evidence-based recommendations
5. **Emergency Multisig**: 6-of-9 for critical security responses

#### Decision Domains

| Domain | Decision Maker | Vote Threshold | Timelock |
|--------|---------------|----------------|----------|
| Protocol Upgrades | Token Holders | 60% approval | 7 days |
| Fee Adjustments | Token Holders | 50% approval | 2 days |
| Hub Registration | Hub Council + Token Holders | 70% approval | 0 days |
| Treasury Spending (>10%) | Token Holders | 75% approval | 7 days |
| Emergency Actions | Multisig | 6-of-9 | 0 days |
| Standards & Certifications | Community Working Groups | Rough consensus | N/A |

#### Anti-Capture Mechanisms

1. **Vote Escrow**: Time-locked tokens receive boosted voting power
2. **Delegation**: Passive holders delegate to active community members
3. **Reputation Scores**: Non-transferable reputation complements token voting
4. **Sybil Resistance**: One verified hub/entity = one additional vote bonus
5. **Rage Quit**: Minority protection allows exit with proportional treasury share

#### Participatory Budgeting

20% of protocol revenue allocated via participatory budgeting:
- Community members propose sustainability projects
- RUS token holders vote on fund allocation
- Projects must align with circularity goals

### Future Enhancements

- **Cross-Chain Bridges**: Enable material passports across multiple blockchains
- **Zero-Knowledge Proofs**: Privacy-preserving commercial data
- **AI Integration**: Machine learning for material condition prediction
- **Carbon Credit NFTs**: Tokenize verified carbon savings from reuse
- **Insurance Protocols**: Decentralized insurance for material quality guarantees

## Working with This Repository

### Typical Tasks
- Update research documentation
- Maintain methodology diagrams
- Add links to relevant token engineering resources
- Document stakeholder engagement findings
- Update project partners or team information

### Important Notes
- Always maintain the research-focused nature of this repository
- When adding technical resources, ensure they align with the project's focus on blockchain, IoT, and circular economy
- Draw.io diagrams should be edited with the Draw.io application or compatible tools
- Any future code development should focus on marketplace prototyping, material tracking, or stakeholder connection systems

## Git Workflow

The repository uses a simple git workflow:
- Main branch: `main`
- Recent commits focus on documentation updates and methodology diagrams
- Commit messages are concise and descriptive

When committing changes, follow the existing pattern of clear, straightforward commit messages describing the documentation updates.
